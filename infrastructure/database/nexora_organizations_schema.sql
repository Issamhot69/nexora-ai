-- ============================================================
-- NEXORA AI — Schéma d'organisation multi-tenant
-- Module: Core Identity & Access (base pour CRM, ERP, Billing,
-- Marketplace, AI Agents, etc.)
-- Base de données: PostgreSQL 14+
-- ============================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ORGANIZATIONS (les entreprises clientes / tenants)
-- ============================================================
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    domain          VARCHAR(255),
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',
    status          VARCHAR(50) NOT NULL DEFAULT 'active',
    trial_ends_at   TIMESTAMPTZ,
    sso_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    sso_provider      VARCHAR(50),
    scim_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_required      BOOLEAN NOT NULL DEFAULT FALSE,
    ip_allowlist      JSONB DEFAULT '[]',
    data_residency    VARCHAR(50) DEFAULT 'global',
    settings        JSONB DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);

-- ============================================================
-- 2. WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_workspaces_org ON workspaces(organization_id);

-- ============================================================
-- 3. USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   VARCHAR(255),
    full_name       VARCHAR(255),
    avatar_url      TEXT,
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret      VARCHAR(255),
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    status          VARCHAR(50) NOT NULL DEFAULT 'active',
    preferences     JSONB DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 4. ROLES
-- ============================================================
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, name)
);

-- ============================================================
-- 5. PERMISSIONS
-- ============================================================
CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(150) UNIQUE NOT NULL,
    module          VARCHAR(50) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    description     TEXT
);

CREATE INDEX idx_permissions_module ON permissions(module);

-- ============================================================
-- 6. ROLE_PERMISSIONS
-- ============================================================
CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 7. MEMBERSHIPS
-- ============================================================
CREATE TABLE memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id),
    workspace_id    UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'active',
    invited_by      UUID REFERENCES users(id),
    invited_at      TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, organization_id, workspace_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_memberships_status ON memberships(status);

-- ============================================================
-- 8. INVITATIONS
-- ============================================================
CREATE TABLE invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    role_id         UUID NOT NULL REFERENCES roles(id),
    token           VARCHAR(255) UNIQUE NOT NULL,
    invited_by      UUID NOT NULL REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_token ON invitations(token);

-- ============================================================
-- 9. API_KEYS
-- ============================================================
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    key_prefix      VARCHAR(20) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL,
    scopes          JSONB DEFAULT '[]',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================================
-- 10. AUDIT_LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(150) NOT NULL,
    module          VARCHAR(50),
    target_type     VARCHAR(100),
    target_id       UUID,
    ip_address      INET,
    user_agent      TEXT,
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- SEED: rôles système par défaut
-- ============================================================
INSERT INTO roles (id, organization_id, name, is_system, description) VALUES
    (gen_random_uuid(), NULL, 'owner',   TRUE, 'Acces total, gestion facturation et suppression organisation'),
    (gen_random_uuid(), NULL, 'admin',   TRUE, 'Gestion complete sauf facturation et suppression organisation'),
    (gen_random_uuid(), NULL, 'manager', TRUE, 'Gestion des modules assignes, pas de gestion des membres'),
    (gen_random_uuid(), NULL, 'member',  TRUE, 'Acces standard aux modules de son workspace'),
    (gen_random_uuid(), NULL, 'viewer',  TRUE, 'Lecture seule'),
    (gen_random_uuid(), NULL, 'billing', TRUE, 'Acces uniquement au module facturation');

-- ============================================================
-- SEED: permissions par module
-- ============================================================
INSERT INTO permissions (code, module, action, description) VALUES
    ('crm.contacts.read',        'crm',          'read',   'Voir les contacts CRM'),
    ('crm.contacts.write',       'crm',          'write',  'Creer/modifier les contacts CRM'),
    ('erp.invoices.read',        'erp',          'read',   'Voir les factures ERP'),
    ('erp.invoices.write',       'erp',          'write',  'Creer/modifier les factures ERP'),
    ('billing.view',             'billing',      'read',   'Voir la facturation'),
    ('billing.manage',           'billing',      'admin',  'Gerer plan et paiements'),
    ('marketplace.publish',      'marketplace',  'publish','Publier un plugin sur le marketplace'),
    ('marketplace.install',      'marketplace',  'write',  'Installer un plugin'),
    ('ai_agents.deploy',         'ai_agents',    'deploy', 'Deployer un agent IA'),
    ('ai_agents.read',           'ai_agents',    'read',   'Voir les agents IA'),
    ('ai_bots.manage',           'ai_bots',      'admin',  'Gerer les bots IA'),
    ('media.upload',             'media',        'write',  'Uploader du contenu media'),
    ('automation.create',        'automation',   'write',  'Creer des workflows d automatisation'),
    ('analytics.view',           'analytics',    'read',   'Voir les tableaux de bord analytics'),
    ('security.audit_logs.view', 'security',     'read',   'Voir les logs d audit'),
    ('security.settings.manage', 'security',     'admin',  'Gerer SSO, MFA, IP allowlist'),
    ('cloud.resources.manage',   'cloud',        'admin',  'Gerer les ressources cloud'),
    ('dev_platform.api_keys.manage', 'dev_platform', 'admin', 'Creer/revoquer des cles API');

-- ============================================================
-- FIN
-- ============================================================
