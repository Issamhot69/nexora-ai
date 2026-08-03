const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const companySchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  notes: z.string().optional(),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

// POST /organizations/:orgId/companies
router.post('/organizations/:orgId/companies', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const company = await prisma.companies.create({
      data: { ...parsed.data, organization_id: orgId, created_by: req.user.userId },
    });
    res.status(201).json({ company });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/companies
router.get('/organizations/:orgId/companies', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const companies = await prisma.companies.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    res.json({ companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /companies/:id
router.get('/companies/:id', async (req, res) => {
  try {
    const company = await prisma.companies.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(company.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });
    res.json({ company });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /companies/:id
router.put('/companies/:id', async (req, res) => {
  try {
    const existing = await prisma.companies.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = companySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const company = await prisma.companies.update({
      where: { id: req.params.id },
      data: { ...parsed.data, updated_at: new Date() },
    });
    res.json({ company });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /companies/:id (soft delete)
router.delete('/companies/:id', async (req, res) => {
  try {
    const existing = await prisma.companies.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.companies.update({
      where: { id: req.params.id },
      data: { deleted_at: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
