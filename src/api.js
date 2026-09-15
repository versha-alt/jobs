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
  auth: {
    me: () => req('GET', '/api/auth/me'),
    signup: (body) => req('POST', '/api/auth/signup', body),
    login: (body) => req('POST', '/api/auth/login', body),
    logout: () => req('POST', '/api/auth/logout'),
  },
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
    runs: (id, params) => req('GET', `/api/triggers/${id}/runs?${new URLSearchParams(params)}`),
  },
  settings: {
    getApify: () => req('GET', '/api/settings/apify'),
    saveApify: (body) => req('PUT', '/api/settings/apify', body),
    getTelegram: () => req('GET', '/api/settings/telegram'),
    saveTelegram: (body) => req('PUT', '/api/settings/telegram', body),
    testTelegram: (body) => req('POST', '/api/settings/telegram/test', body),
  },
  jobs: {
    list: (params) => req('GET', `/api/jobs?${new URLSearchParams(params)}`),
    get: (id) => req('GET', `/api/jobs/${id}`),
    bookmark: (id) => req('POST', `/api/jobs/${id}/bookmark`),
    dismiss: (id) => req('POST', `/api/jobs/${id}/dismiss`),
  },
  runs: {
    list: (limit = 50) => req('GET', `/api/runs?limit=${limit}`),
    get: (id) => req('GET', `/api/runs/${id}`),
    job: (runId, source, jobId) =>
      req('GET', `/api/runs/${runId}/jobs/${source}/${encodeURIComponent(jobId)}`),
    since: (iso) => req('GET', `/api/runs?since=${encodeURIComponent(iso)}&limit=20`),
    remove: (id) => req('DELETE', `/api/runs/${id}`),
  },
};
