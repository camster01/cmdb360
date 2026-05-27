const BASE = '/api';

export function setCurrentSystemId(id: string | null) {
  if (id) localStorage.setItem('cmdb360_system', id);
  else localStorage.removeItem('cmdb360_system');
}

function getToken(): string | null {
  return localStorage.getItem('cmdb360_token');
}

function getSystemId(): string | null {
  return localStorage.getItem('cmdb360_system');
}

async function request(method: string, path: string, body?: unknown, systemScoped = false): Promise<unknown> {
  const token = getToken();
  const systemId = getSystemId();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (systemScoped && systemId) headers['X-System-ID'] = systemId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('cmdb360_token');
    window.location.reload();
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),

  getSystems: () => request('GET', '/systems'),
  createSystem: (s: object) => request('POST', '/systems', s),
  updateSystem: (id: string, s: object) => request('PUT', `/systems/${id}`, s),
  deleteSystem: (id: string) => request('DELETE', `/systems/${id}`),
  getSystemMembers: (id: string) => request('GET', `/systems/${id}/members`),
  setSystemMemberRole: (systemId: string, userId: string, role: string) =>
    request('PUT', `/systems/${systemId}/members/${userId}`, { role }),
  removeSystemMember: (systemId: string, userId: string) =>
    request('DELETE', `/systems/${systemId}/members/${userId}`),

  getDimensions: () => request('GET', '/dimensions', undefined, true),
  createDimension: (d: object) => request('POST', '/dimensions', d, true),
  updateDimension: (id: string, d: object) => request('PUT', `/dimensions/${id}`, d, true),
  deleteDimension: (id: string) => request('DELETE', `/dimensions/${id}`, undefined, true),

  getItems: () => request('GET', '/items', undefined, true),
  createItem: (i: object) => request('POST', '/items', i, true),
  updateItem: (id: string, i: object) => request('PUT', `/items/${id}`, i, true),
  deleteItem: (id: string) => request('DELETE', `/items/${id}`, undefined, true),

  getRelationships: () => request('GET', '/relationships', undefined, true),
  createRelationship: (r: object) => request('POST', '/relationships', r, true),
  deleteRelationship: (id: string) => request('DELETE', `/relationships/${id}`, undefined, true),

  getUsers: () => request('GET', '/users'),
  createUser: (u: object) => request('POST', '/users', u),
  updateUser: (id: string, u: object) => request('PUT', `/users/${id}`, u),
  deleteUser: (id: string) => request('DELETE', `/users/${id}`),

  getSettings: () => request('GET', '/settings'),
  updateSetting: (key: string, value: string) => request('PUT', `/settings/${key}`, { value }),

  // Dimension field definitions
  getDimensionFields: (dimensionId: string) =>
    request('GET', `/fields?dimensionId=${encodeURIComponent(dimensionId)}`, undefined, true),
  createDimensionField: (f: object) => request('POST', '/fields', f, true),
  updateDimensionField: (id: string, f: object) => request('PUT', `/fields/${id}`, f, true),
  deleteDimensionField: (id: string) => request('DELETE', `/fields/${id}`, undefined, true),

  // Item field values
  getItemFieldValues: (itemId: string) =>
    request('GET', `/fields/values/${itemId}`, undefined, true),
  saveItemFieldValues: (itemId: string, values: Record<string, string>) =>
    request('PUT', `/fields/values/${itemId}`, { values }, true),

  // Org hierarchy (unlimited depth)
  getOrg: () => request('GET', '/org', undefined, true),
  saveOrgLabels: (labels: string[]) => request('PUT', '/org/labels', { labels }, true),
  createOrgNode: (data: { parent_id?: string | null; name: string; description?: string; children_label?: string | null }) =>
    request('POST', '/org/nodes', data, true),
  updateOrgNode: (id: string, data: { name?: string; description?: string; children_label?: string | null }) =>
    request('PUT', `/org/nodes/${id}`, data, true),
  deleteOrgNode: (id: string) => request('DELETE', `/org/nodes/${id}`, undefined, true),
};

export async function streamChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void
): Promise<void> {
  const token = localStorage.getItem('cmdb360_token');
  const systemId = getSystemId();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (systemId) headers['X-System-ID'] = systemId;

  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as { text?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) onChunk(parsed.text);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
}
