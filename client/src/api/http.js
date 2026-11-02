import { ApiError, SESSION_EXPIRED } from './errors.js';

const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
    throw new ApiError(response.status, data?.error ?? 'Nie udało się wykonać tej operacji.', data?.fields);
  }
  return data;
}

export const httpApi = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  dashboard: () => request('/dashboard'),
  listUsers: () => request('/users'),

  listOrders: (params) => request(`/orders${queryString(params)}`),
  exportOrdersUrl: (params) => `/api/orders/export.csv${queryString(params)}`,
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (data) => request('/orders', { method: 'POST', body: data }),
  updateOrder: (id, data) => request(`/orders/${id}`, { method: 'PATCH', body: data }),
  changeStatus: (id, data) => request(`/orders/${id}/status`, { method: 'POST', body: data }),
  addNote: (id, note) => request(`/orders/${id}/notes`, { method: 'POST', body: { note } }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: 'DELETE' }),

  listClients: (params) => request(`/clients${queryString(params)}`),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: data }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PATCH', body: data }),
};
