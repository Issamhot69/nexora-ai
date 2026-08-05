const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');
const { askAgent } = require('../agents/businessAgent');

const router = express.Router();
router.use(authMiddleware);

const askSchema = z.object({
  question: z.string().min(1).max(1000),
});

async function checkMembership(orgId, userId) {
  return prisma.memberships.findFirst({
    where: { organization_id: orgId, user_id: userId, status: 'active' },
  });
}

// POST /organizations/:orgId/agent/ask
router.post('/organizations/:orgId/agent/ask', async (req, res) => {
  try {
    const { orgId } = req.params;
    const membership = await checkMembership(orgId, req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Acces refuse' });

    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const answer = await askAgent(orgId, parsed.data.question);
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la consultation de l agent IA', detail: err.message });
  }
});

module.exports = router;
