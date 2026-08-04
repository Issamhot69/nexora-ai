const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit_price: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  reorder_point: z.number().nonnegative().optional(),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

// POST /organizations/:orgId/products
router.post('/organizations/:orgId/products', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const product = await prisma.products.create({
      data: { ...parsed.data, organization_id: orgId, created_by: req.user.userId },
    });
    res.status(201).json({ product });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ce SKU existe deja' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/products
router.get('/organizations/:orgId/products', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const products = await prisma.products.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /products/:id
router.put('/products/:id', async (req, res) => {
  try {
    const existing = await prisma.products.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const product = await prisma.products.update({
      where: { id: req.params.id },
      data: { ...parsed.data, updated_at: new Date() },
    });
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /products/:id (soft delete)
router.delete('/products/:id', async (req, res) => {
  try {
    const existing = await prisma.products.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.products.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
