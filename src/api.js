async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  health: () => req('GET', '/api/health'),
  modules: {
    list: () => req('GET', '/api/modules'),
  },
  countries: {
    list: () => req('GET', '/api/countries'),
    add: (name) => req('POST', '/api/countries', { name }),
    remove: (id) => req('DELETE', `/api/countries/${id}`),
  },
  searches: {
    list: () => req('GET', '/api/searches'),
    create: (body) => req('POST', '/api/searches', body),
    update: (id, body) => req('PUT', `/api/searches/${id}`, body),
    remove: (id) => req('DELETE', `/api/searches/${id}`),
  },
  triggers: {
    list: () => req('GET', '/api/triggers'),
    create: (body) => req('POST', '/api/triggers', body),
    update: (id, body) => req('PUT', `/api/triggers/${id}`, body),
    remove: (id) => req('DELETE', `/api/triggers/${id}`),
    runNow: (id) => req('POST', `/api/triggers/${id}/run`),
  },
  runs: {
    list: (limit = 50) => req('GET', `/api/runs?limit=${limit}`),
    get: (id) => req('GET', `/api/runs/${id}`),
    since: (iso) => req('GET', `/api/runs?since=${encodeURIComponent(iso)}&limit=20`),
    remove: (id) => req('DELETE', `/api/runs/${id}`),
  },
};
