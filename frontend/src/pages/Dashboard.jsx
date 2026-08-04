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
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
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
    if (tab === 'quotes') setQuotes((await api.listQuotes(currentOrg.id)).quotes);
    if (tab === 'invoices') setInvoices((await api.listInvoices(currentOrg.id)).invoices);
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
              {['deals', 'quotes', 'invoices', 'companies', 'contacts'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 font-medium capitalize ${tab === t ? 'border-b-2 border-slate-800 text-slate-800' : 'text-slate-400'}`}
                >
                  {t === 'deals' ? 'Deals' : t === 'quotes' ? 'Devis' : t === 'invoices' ? 'Factures' : t === 'companies' ? 'Entreprises' : 'Contacts'}
                </button>
              ))}
            </div>

            {tab === 'deals' && <DealsTab orgId={currentOrg.id} deals={deals} companies={companies} contacts={contacts} onChange={loadData} />}
            {tab === 'quotes' && <QuotesTab orgId={currentOrg.id} quotes={quotes} companies={companies} onChange={loadData} />}
            {tab === 'invoices' && <InvoicesTab orgId={currentOrg.id} invoices={invoices} companies={companies} onChange={loadData} />}
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

const QUOTE_STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoye', accepted: 'Accepte', rejected: 'Refuse', expired: 'Expire' };
const INVOICE_STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoyee', paid: 'Payee', overdue: 'En retard', cancelled: 'Annulee' };

function LineItemsForm({ items, setItems }) {
  function updateItem(i, field, value) {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  }
  function addItem() {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  }
  function removeItem(i) {
    setItems(items.filter((_, idx) => idx !== i));
  }
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  return (
    <div className="space-y-2 mb-3">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            placeholder="Description"
            value={it.description}
            onChange={(e) => updateItem(i, 'description', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 flex-1 text-sm"
          />
          <input
            type="number" placeholder="Qte" value={it.quantity}
            onChange={(e) => updateItem(i, 'quantity', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 w-20 text-sm"
          />
          <input
            type="number" placeholder="Prix unitaire" value={it.unit_price}
            onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 w-28 text-sm"
          />
          <button type="button" onClick={() => removeItem(i)} className="text-red-400 text-sm px-2">x</button>
        </div>
      ))}
      <div className="flex justify-between items-center">
        <button type="button" onClick={addItem} className="text-sm text-slate-500 hover:underline">+ ligne</button>
        <p className="text-sm text-slate-600">Sous-total: {total.toFixed(2)}</p>
      </div>
    </div>
  );
}

function QuotesTab({ orgId, quotes, companies, onChange }) {
  const [companyId, setCompanyId] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) return;
    await api.createQuote(orgId, {
      company_id: companyId || null,
      items: validItems.map((it) => ({ ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price) })),
    });
    setItems([{ description: '', quantity: 1, unit_price: 0 }]);
    setCompanyId('');
    setShowForm(false);
    onChange();
  }

  async function handleStatusChange(id, status) {
    await api.updateQuoteStatus(id, status);
    onChange();
  }

  return (
    <div>
      <button onClick={() => setShowForm(!showForm)} className="mb-4 text-sm bg-slate-800 text-white rounded-lg px-4 py-2">
        {showForm ? 'Annuler' : '+ Nouveau devis'}
      </button>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 mb-3 text-sm">
            <option value="">Sans entreprise</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <LineItemsForm items={items} setItems={setItems} />
          <button type="submit" className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm">Creer le devis</button>
        </form>
      )}

      <div className="grid gap-2">
        {quotes.map((q) => (
          <div key={q.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{q.quote_number} {q.companies ? `· ${q.companies.name}` : ''}</p>
              <p className="text-sm text-slate-500">Sous-total {q.subtotal} {q.currency} · TVA {q.tax_rate}% · Total {q.total} {q.currency}</p>
            </div>
            <select value={q.status} onChange={(e) => handleStatusChange(q.id, e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm">
              {Object.entries(QUOTE_STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoicesTab({ orgId, invoices, companies, onChange }) {
  const [companyId, setCompanyId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) return;
    await api.createInvoice(orgId, {
      company_id: companyId || null,
      due_date: dueDate || null,
      items: validItems.map((it) => ({ ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price) })),
    });
    setItems([{ description: '', quantity: 1, unit_price: 0 }]);
    setCompanyId(''); setDueDate('');
    setShowForm(false);
    onChange();
  }

  async function handleStatusChange(id, status) {
    await api.updateInvoiceStatus(id, status);
    onChange();
  }

  return (
    <div>
      <button onClick={() => setShowForm(!showForm)} className="mb-4 text-sm bg-slate-800 text-white rounded-lg px-4 py-2">
        {showForm ? 'Annuler' : '+ Nouvelle facture'}
      </button>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
          <div className="flex gap-2 mb-3">
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm">
              <option value="">Sans entreprise</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm" />
          </div>
          <LineItemsForm items={items} setItems={setItems} />
          <button type="submit" className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm">Creer la facture</button>
        </form>
      )}

      <div className="grid gap-2">
        {invoices.map((inv) => (
          <div key={inv.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{inv.invoice_number} {inv.companies ? `· ${inv.companies.name}` : ''}</p>
              <p className="text-sm text-slate-500">Total {inv.total} {inv.currency} {inv.status === 'paid' ? `· Paye le ${new Date(inv.paid_at).toLocaleDateString()}` : inv.due_date ? `· Echeance ${new Date(inv.due_date).toLocaleDateString()}` : ''}</p>
            </div>
            <select value={inv.status} onChange={(e) => handleStatusChange(inv.id, e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm">
              {Object.entries(INVOICE_STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
