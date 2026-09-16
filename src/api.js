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
  routines: {
    list: () => req('GET', '/api/routines'),
    get: (id) => req('GET', `/api/routines/${id}`),
    create: (body) => req('POST', '/api/routines', body),
    update: (id, body) => req('PUT', `/api/routines/${id}`, body),
    remove: (id) => req('DELETE', `/api/routines/${id}`),
    runNow: (id) => req('POST', `/api/routines/${id}/run`),
    runs: (id, params) => req('GET', `/api/routines/${id}/runs?${new URLSearchParams(params)}`),
    addSchedule: (id, body) => req('POST', `/api/routines/${id}/schedules`, body),
    removeSchedule: (id, sid) => req('DELETE', `/api/routines/${id}/schedules/${sid}`),
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
  analytics: {
    jobsByDay: (days = 14) => req('GET', `/api/analytics/jobs-by-day?days=${days}`),
    jobsByLocation: () => req('GET', '/api/analytics/jobs-by-location'),
    sourceYield: () => req('GET', '/api/analytics/source-yield'),
    jobsByPlatform: () => req('GET', '/api/analytics/jobs-by-platform'),
  },
};
