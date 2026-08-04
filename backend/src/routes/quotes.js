const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit_price: z.number().nonnegative().default(0),
});

const quoteSchema = z.object({
  deal_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(), // si absent, calcule depuis le pays de l organisation
  valid_until: z.string().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

async function resolveTaxRate(orgId, providedRate) {
  if (providedRate !== undefined) return providedRate;
  const org = await prisma.organizations.findUnique({ where: { id: orgId } });
  const taxRate = await prisma.tax_rates.findFirst({
    where: { country_code: org?.tax_country || 'FR', is_default: true },
  });
  return taxRate ? Number(taxRate.rate) : 0;
}

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

function computeTotals(items, taxRate) {
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const total = subtotal * (1 + taxRate / 100);
  return { subtotal, total };
}

async function nextNumber(orgId, prefix, model) {
  const count = await model.count({ where: { organization_id: orgId } });
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

// POST /organizations/:orgId/quotes
router.post('/organizations/:orgId/quotes', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const { items, ...quoteData } = parsed.data;
    const resolvedTaxRate = await resolveTaxRate(orgId, quoteData.tax_rate);
    quoteData.tax_rate = resolvedTaxRate;
    const { subtotal, total } = computeTotals(items, resolvedTaxRate);
    const quote_number = await nextNumber(orgId, 'DEV', prisma.quotes);

    const quote = await prisma.quotes.create({
      data: {
        ...quoteData,
        organization_id: orgId,
        created_by: req.user.userId,
        quote_number,
        subtotal,
        total,
        valid_until: quoteData.valid_until ? new Date(quoteData.valid_until) : null,
        quote_items: {
          create: items.map((it, i) => ({
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.quantity * it.unit_price,
            position: i,
          })),
        },
      },
      include: { quote_items: true },
    });

    res.status(201).json({ quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/quotes
router.get('/organizations/:orgId/quotes', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const quotes = await prisma.quotes.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: { quote_items: true, companies: true, contacts: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ quotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /quotes/:id
router.get('/quotes/:id', async (req, res) => {
  try {
    const quote = await prisma.quotes.findUnique({
      where: { id: req.params.id },
      include: { quote_items: true, companies: true, contacts: true },
    });
    if (!quote) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(quote.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });
    res.json({ quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /quotes/:id/status - changer le statut (draft/sent/accepted/rejected/expired)
router.put('/quotes/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

    const existing = await prisma.quotes.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const quote = await prisma.quotes.update({
      where: { id: req.params.id },
      data: { status, updated_at: new Date() },
    });
    res.json({ quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /quotes/:id
router.delete('/quotes/:id', async (req, res) => {
  try {
    const existing = await prisma.quotes.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.quotes.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
