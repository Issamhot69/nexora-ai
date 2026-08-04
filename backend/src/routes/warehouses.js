const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const warehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  is_default: z.boolean().optional(),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

// POST /organizations/:orgId/warehouses
router.post('/organizations/:orgId/warehouses', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = warehouseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const warehouse = await prisma.warehouses.create({
      data: { ...parsed.data, organization_id: orgId },
    });
    res.status(201).json({ warehouse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/warehouses
router.get('/organizations/:orgId/warehouses', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const warehouses = await prisma.warehouses.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'asc' },
    });
    res.json({ warehouses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /warehouses/:id
router.put('/warehouses/:id', async (req, res) => {
  try {
    const existing = await prisma.warehouses.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = warehouseSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const warehouse = await prisma.warehouses.update({
      where: { id: req.params.id },
      data: { ...parsed.data, updated_at: new Date() },
    });
    res.json({ warehouse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /warehouses/:id
router.delete('/warehouses/:id', async (req, res) => {
  try {
    const existing = await prisma.warehouses.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.warehouses.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
