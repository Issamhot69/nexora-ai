const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// POST /organizations - creer une organisation, le createur devient owner
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    let baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.organizations.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const ownerRole = await prisma.roles.findFirst({
      where: { name: 'owner', organization_id: null },
    });
    if (!ownerRole) {
      return res.status(500).json({ error: 'Role owner introuvable, verifiez le seed' });
    }

    const org = await prisma.organizations.create({
      data: {
        name,
        slug,
        memberships: {
          create: {
            user_id: req.user.userId,
            role_id: ownerRole.id,
            status: 'active',
            joined_at: new Date(),
          },
        },
      },
      include: { memberships: true },
    });

    res.status(201).json({ organization: org });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations - lister les organisations de l utilisateur connecte
router.get('/', async (req, res) => {
  try {
    const memberships = await prisma.memberships.findMany({
      where: { user_id: req.user.userId, status: 'active' },
      include: {
        organizations: true,
        roles: true,
      },
    });

    const organizations = memberships.map((m) => ({
      id: m.organizations.id,
      name: m.organizations.name,
      slug: m.organizations.slug,
      plan: m.organizations.plan,
      role: m.roles.name,
    }));

    res.json({ organizations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /organizations/:id/members - lister les membres d une organisation
router.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;

    const requesterMembership = await prisma.memberships.findFirst({
      where: { organization_id: id, user_id: req.user.userId, status: 'active' },
    });
    if (!requesterMembership) {
      return res.status(403).json({ error: 'Acces refuse a cette organisation' });
    }

    const members = await prisma.memberships.findMany({
      where: { organization_id: id },
      include: { users: true, roles: true },
    });

    const result = members.map((m) => ({
      user_id: m.users.id,
      email: m.users.email,
      full_name: m.users.full_name,
      role: m.roles.name,
      status: m.status,
    }));

    res.json({ members: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /organizations/:id/members - ajouter un membre existant avec un role
router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email et role requis' });
    }

    const requesterMembership = await prisma.memberships.findFirst({
      where: { organization_id: id, user_id: req.user.userId, status: 'active' },
      include: { roles: true },
    });
    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.roles.name)) {
      return res.status(403).json({ error: 'Seuls owner/admin peuvent ajouter des membres' });
    }

    const targetUser = await prisma.users.findUnique({ where: { email } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable, il doit d abord creer un compte' });
    }

    const targetRole = await prisma.roles.findFirst({
      where: { name: role, organization_id: null },
    });
    if (!targetRole) {
      return res.status(400).json({ error: 'Role invalide' });
    }

    const membership = await prisma.memberships.create({
      data: {
        user_id: targetUser.id,
        organization_id: id,
        role_id: targetRole.id,
        status: 'active',
        joined_at: new Date(),
      },
    });

    res.status(201).json({ membership });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Cet utilisateur est deja membre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
