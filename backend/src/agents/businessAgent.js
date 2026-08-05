const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../lib/prisma');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function gatherContext(orgId) {
  const [deals, invoices, stockLevels, org] = await Promise.all([
    prisma.deals.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: { companies: true },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.invoices.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: { companies: true },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.stock_movements.findMany({
      where: { organization_id: orgId },
      include: { products: true, warehouses: true },
    }),
    prisma.organizations.findUnique({ where: { id: orgId } }),
  ]);

  // recalcule les niveaux de stock (meme logique que /stock-levels)
  const levels = {};
  for (const m of stockLevels) {
    const key = `${m.product_id}__${m.warehouse_id}`;
    if (!levels[key]) {
      levels[key] = {
        product: m.products.name,
        sku: m.products.sku,
        warehouse: m.warehouses.name,
        reorder_point: Number(m.products.reorder_point),
        quantity: 0,
      };
    }
    const signed = m.type === 'out' ? -Math.abs(Number(m.quantity)) : Number(m.quantity);
    levels[key].quantity += signed;
  }

  return {
    organization: { name: org.name, tax_country: org.tax_country },
    deals: deals.map((d) => ({
      title: d.title, stage: d.stage, value: Number(d.value), currency: d.currency,
      company: d.companies?.name || null,
    })),
    invoices: invoices.map((i) => ({
      number: i.invoice_number, status: i.status, total: Number(i.total),
      amount_paid: Number(i.amount_paid), currency: i.currency,
      due_date: i.due_date, company: i.companies?.name || null,
    })),
    stock_levels: Object.values(levels),
  };
}

async function askAgent(orgId, question) {
  const context = await gatherContext(orgId);

  const systemPrompt = `Tu es l'assistant business de Nexora AI. Tu reponds aux questions sur les donnees de l'entreprise (deals, factures, stock) de facon precise, concise et utile, en francais. Utilise uniquement les donnees fournies ci-dessous, ne les invente jamais. Si une information n'est pas disponible dans les donnees, dis-le clairement.

Donnees de l'organisation "${context.organization.name}":
${JSON.stringify(context, null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : 'Pas de reponse disponible.';
}

module.exports = { askAgent, gatherContext };
