import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const STAGE_LABELS = {
  prospect: 'Prospect',
  qualified: 'Qualifie',
  proposed: 'Propose',
  won: 'Gagne',
  lost: 'Perdu',
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [tab, setTab] = useState('deals');
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [showNewOrg, setShowNewOrg] = useState(false);

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { if (currentOrg) loadData(); }, [currentOrg, tab]);

  async function loadOrgs() {
    const data = await api.listOrganizations();
    setOrgs(data.organizations);
    if (data.organizations.length > 0 && !currentOrg) {
      setCurrentOrg(data.organizations[0]);
    }
  }

  async function loadData() {
    if (!currentOrg) return;
    if (tab === 'companies') setCompanies((await api.listCompanies(currentOrg.id)).companies);
    if (tab === 'contacts') setContacts((await api.listContacts(currentOrg.id)).contacts);
    if (tab === 'deals') setDeals((await api.listDeals(currentOrg.id)).deals);
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const data = await api.createOrganization({ name: newOrgName });
    setNewOrgName('');
    setShowNewOrg(false);
    await loadOrgs();
    setCurrentOrg({ id: data.organization.id, name: data.organization.name, role: 'owner' });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nexora AI</h1>
          <p className="text-sm text-slate-500">{user?.full_name || user?.email}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
          Deconnexion
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* Selecteur d'organisation */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={currentOrg?.id || ''}
            onChange={(e) => setCurrentOrg(orgs.find((o) => o.id === e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.role})</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewOrg(!showNewOrg)}
            className="text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            + Nouvelle organisation
          </button>
        </div>

        {showNewOrg && (
          <form onSubmit={handleCreateOrg} className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Nom de l'organisation"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 flex-1"
            />
            <button type="submit" className="bg-slate-800 text-white rounded-lg px-4 py-2">Creer</button>
          </form>
        )}

        {!currentOrg ? (
          <p className="text-slate-500">Creez une organisation pour commencer.</p>
        ) : (
          <>
            {/* Onglets */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
              {['deals', 'companies', 'contacts'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 font-medium capitalize ${tab === t ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-400'}`}
                >
                  {t === 'deals' ? 'Deals' : t === 'companies' ? 'Entreprises' : 'Contacts'}
                </button>
              ))}
            </div>

            {tab === 'deals' && <DealsTab orgId={currentOrg.id} deals={deals} companies={companies} contacts={contacts} onChange={loadData} />}
            {tab === 'companies' && <CompaniesTab orgId={currentOrg.id} companies={companies} onChange={loadData} />}
            {tab === 'contacts' && <ContactsTab orgId={currentOrg.id} contacts={contacts} companies={companies} onChange={loadData} />}
          </>
        )}
      </div>
    </div>
  );
}

function CompaniesTab({ orgId, companies, onChange }) {
  const [name, setName] = useState('');
  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createCompany(orgId, { name });
    setName('');
    onChange();
  }
  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'entreprise"
          className="border border-slate-300 rounded-lg px-3 py-2 flex-1" />
        <button className="bg-slate-800 text-white rounded-lg px-4 py-2">Ajouter</button>
      </form>
      <div className="grid gap-2">
        {companies.map((c) => (
          <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200">
            <p className="font-medium text-slate-800">{c.name}</p>
            <p className="text-sm text-slate-500">{c.industry || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactsTab({ orgId, contacts, companies, onChange }) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  async function handleAdd(e) {
    e.preventDefault();
    if (!firstName.trim()) return;
    await api.createContact(orgId, { first_name: firstName, email });
    setFirstName(''); setEmail('');
    onChange();
  }
  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prenom"
          className="border border-slate-300 rounded-lg px-3 py-2" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="border border-slate-300 rounded-lg px-3 py-2 flex-1" />
        <button className="bg-slate-800 text-white rounded-lg px-4 py-2">Ajouter</button>
      </form>
      <div className="grid gap-2">
        {contacts.map((c) => (
          <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200">
            <p className="font-medium text-slate-800">{c.first_name} {c.last_name || ''}</p>
            <p className="text-sm text-slate-500">{c.email || '—'} {c.companies ? `· ${c.companies.name}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealsTab({ orgId, deals, companies, contacts, onChange }) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.createDeal(orgId, { title, value: value ? Number(value) : 0 });
    setTitle(''); setValue('');
    onChange();
  }

  async function handleStageChange(dealId, stage) {
    await api.updateDeal(dealId, { stage });
    onChange();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du deal"
          className="border border-slate-300 rounded-lg px-3 py-2 flex-1" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valeur (EUR)" type="number"
          className="border border-slate-300 rounded-lg px-3 py-2 w-40" />
        <button className="bg-slate-800 text-white rounded-lg px-4 py-2">Ajouter</button>
      </form>
      <div className="grid gap-2">
        {deals.map((d) => (
          <div key={d.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{d.title}</p>
              <p className="text-sm text-slate-500">{d.value} {d.currency} {d.companies ? `· ${d.companies.name}` : ''}</p>
            </div>
            <select
              value={d.stage}
              onChange={(e) => handleStageChange(d.id, e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
            >
              {Object.entries(STAGE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
