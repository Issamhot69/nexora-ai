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

const invoiceSchema = z.object({
  quote_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(), // si absent, calcule depuis le pays de l organisation
  due_date: z.string().optional().nullable(),
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

// POST /organizations/:orgId/invoices
router.post('/organizations/:orgId/invoices', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const { items, ...invoiceData } = parsed.data;
    const resolvedTaxRate = await resolveTaxRate(orgId, invoiceData.tax_rate);
    invoiceData.tax_rate = resolvedTaxRate;
    const { subtotal, total } = computeTotals(items, resolvedTaxRate);
    const invoice_number = await nextNumber(orgId, 'FAC', prisma.invoices);

    const invoice = await prisma.invoices.create({
      data: {
        ...invoiceData,
        organization_id: orgId,
        created_by: req.user.userId,
        invoice_number,
        subtotal,
        total,
        due_date: invoiceData.due_date ? new Date(invoiceData.due_date) : null,
        invoice_items: {
          create: items.map((it, i) => ({
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.quantity * it.unit_price,
            position: i,
          })),
        },
      },
      include: { invoice_items: true },
    });

    res.status(201).json({ invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:orgId/invoices  (optionnel: ?status=paid)
router.get('/organizations/:orgId/invoices', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const where = { organization_id: orgId, deleted_at: null };
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (req.query.status && validStatuses.includes(req.query.status)) {
      where.status = req.query.status;
    }

    const invoices = await prisma.invoices.findMany({
      where,
      include: { invoice_items: true, companies: true, contacts: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ invoices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /invoices/:id
router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoices.findUnique({
      where: { id: req.params.id },
      include: { invoice_items: true, companies: true, contacts: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(invoice.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });
    res.json({ invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /invoices/:id/status
router.put('/invoices/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

    const existing = await prisma.invoices.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const data = { status, updated_at: new Date() };
    if (status === 'paid') {
      data.paid_at = new Date();
      data.amount_paid = existing.total;
    }

    const invoice = await prisma.invoices.update({ where: { id: req.params.id }, data });
    res.json({ invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /invoices/:id
router.delete('/invoices/:id', async (req, res) => {
  try {
    const existing = await prisma.invoices.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const membership = await checkMembership(existing.organization_id, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    await prisma.invoices.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
