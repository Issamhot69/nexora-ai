const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const contactSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  company_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

// POST /organizations/:orgId/contacts
router.post('/organizations/:orgId/contacts', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const contact = await prisma.contacts.create({
      data: { ...parsed.data, organization_id: orgId, created_by: req.user.userId },
    });
    res.status(201).json({ contact });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/contacts
router.get('/organizations/:orgId/contacts', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const contacts = await prisma.contacts.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: { companies: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ contacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /contacts/:id
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await prisma.contacts.findUnique({
      where: { id: req.params.id },
      include: { companies: true },
    });
    if (!contact) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(contact.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });
    res.json({ contact });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /contacts/:id
router.put('/contacts/:id', async (req, res) => {
  try {
    const existing = await prisma.contacts.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = contactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const contact = await prisma.contacts.update({
      where: { id: req.params.id },
      data: { ...parsed.data, updated_at: new Date() },
    });
    res.json({ contact });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /contacts/:id (soft delete)
router.delete('/contacts/:id', async (req, res) => {
  try {
    const existing = await prisma.contacts.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.contacts.update({
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
