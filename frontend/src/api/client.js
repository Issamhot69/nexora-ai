const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const token = localStorage.getItem('nexora_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  listOrganizations: () => request('/organizations'),
  createOrganization: (body) => request('/organizations', { method: 'POST', body: JSON.stringify(body) }),

  listCompanies: (orgId) => request(`/organizations/${orgId}/companies`),
  createCompany: (orgId, body) => request(`/organizations/${orgId}/companies`, { method: 'POST', body: JSON.stringify(body) }),
  deleteCompany: (id) => request(`/companies/${id}`, { method: 'DELETE' }),

  listContacts: (orgId) => request(`/organizations/${orgId}/contacts`),
  createContact: (orgId, body) => request(`/organizations/${orgId}/contacts`, { method: 'POST', body: JSON.stringify(body) }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),

  listDeals: (orgId) => request(`/organizations/${orgId}/deals`),
  createDeal: (orgId, body) => request(`/organizations/${orgId}/deals`, { method: 'POST', body: JSON.stringify(body) }),
  updateDeal: (id, body) => request(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDeal: (id) => request(`/deals/${id}`, { method: 'DELETE' }),
};
