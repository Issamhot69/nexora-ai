const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const STAGES = ['prospect', 'qualified', 'proposed', 'won', 'lost'];

const dealSchema = z.object({
  title: z.string().min(1),
  value: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
  notes: z.string().optional(),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

// POST /organizations/:orgId/deals
router.post('/organizations/:orgId/deals', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = dealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const data = { ...parsed.data, organization_id: orgId, created_by: req.user.userId };
    if (data.expected_close_date) data.expected_close_date = new Date(data.expected_close_date);

    const deal = await prisma.deals.create({ data });
    res.status(201).json({ deal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/deals  (optionnel: ?stage=qualified)
router.get('/organizations/:orgId/deals', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const where = { organization_id: orgId, deleted_at: null };
    if (req.query.stage && STAGES.includes(req.query.stage)) {
      where.stage = req.query.stage;
    }

    const deals = await prisma.deals.findMany({
      where,
      include: { companies: true, contacts: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ deals, stages: STAGES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /deals/:id
router.get('/deals/:id', async (req, res) => {
  try {
    const deal = await prisma.deals.findUnique({
      where: { id: req.params.id },
      include: { companies: true, contacts: true },
    });
    if (!deal) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(deal.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });
    res.json({ deal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /deals/:id (utilise aussi pour changer l'etape: {"stage":"won"})
router.put('/deals/:id', async (req, res) => {
  try {
    const existing = await prisma.deals.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = dealSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const data = { ...parsed.data, updated_at: new Date() };
    if (data.expected_close_date) data.expected_close_date = new Date(data.expected_close_date);

    const deal = await prisma.deals.update({ where: { id: req.params.id }, data });
    res.json({ deal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /deals/:id (soft delete)
router.delete('/deals/:id', async (req, res) => {
  try {
    const existing = await prisma.deals.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.deals.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
