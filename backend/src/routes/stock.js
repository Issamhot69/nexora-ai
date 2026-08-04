const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const movementSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number(),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

function signedQuantity(type, quantity) {
  // in et adjustment positif ajoutent, out et adjustment negatif retirent
  if (type === 'out') return -Math.abs(quantity);
  if (type === 'in') return Math.abs(quantity);
  return quantity; // adjustment: le signe fourni fait foi
}

// POST /organizations/:orgId/stock-movements
router.post('/organizations/:orgId/stock-movements', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const movement = await prisma.stock_movements.create({
      data: { ...parsed.data, organization_id: orgId, created_by: req.user.userId },
    });
    res.status(201).json({ movement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/stock-movements  (historique, optionnel: ?product_id=...)
router.get('/organizations/:orgId/stock-movements', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const where = { organization_id: orgId };
    if (req.query.product_id) where.product_id = req.query.product_id;

    const movements = await prisma.stock_movements.findMany({
      where,
      include: { products: true, warehouses: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ movements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/stock-levels - stock actuel calcule par produit x entrepot
router.get('/organizations/:orgId/stock-levels', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const movements = await prisma.stock_movements.findMany({
      where: { organization_id: orgId },
      include: { products: true, warehouses: true },
    });

    const levels = {};
    for (const m of movements) {
      const key = `${m.product_id}__${m.warehouse_id}`;
      if (!levels[key]) {
        levels[key] = {
          product_id: m.product_id,
          product_name: m.products.name,
          product_sku: m.products.sku,
          reorder_point: Number(m.products.reorder_point),
          warehouse_id: m.warehouse_id,
          warehouse_name: m.warehouses.name,
          quantity: 0,
        };
      }
      levels[key].quantity += signedQuantity(m.type, Number(m.quantity));
    }

    const result = Object.values(levels).map((l) => ({
      ...l,
      low_stock: l.quantity <= l.reorder_point,
    }));

    res.json({ stock_levels: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
