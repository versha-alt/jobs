import { Router } from 'express';
import db, { parseSearchRow, parseTriggerRow } from './db.js';
import { fireTrigger } from './engine.js';
import { telegramConfigured } from './telegram.js';
import { config } from './config.js';
import { getModule, listModules } from './modules/index.js';
import {
  uid,
  nowIso,
  TIME_FILTERS,
  TIME_FILTER_DEFAULT,
  MODULES,
  FREQUENCIES,
  computeNextRun,
} from './util.js';

const r = Router();

const bad = (res, msg) => res.status(400).json({ error: msg });

const cleanList = (v) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : [];

function validTriggerBody(body) {
  const label = String(body.label ?? '').trim();
  if (!label) return { error: 'Label is required' };
  const module = String(body.module ?? '');
  if (!MODULES.includes(module)) return { error: 'Module must be linkedin or upwork' };
  const mod = getModule(module);
  const linked = String(body.linked_search_id ?? '');
  const search = db.prepare('SELECT id FROM searches WHERE id = ?').get(linked);
  if (!search) return { error: 'Linked search not found' };
  const frequency = String(body.frequency ?? '');
  if (!FREQUENCIES.includes(frequency)) return { error: 'Frequency must be hourly, daily or weekly' };
  let time = String(body.time ?? '09:00');
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) time = '09:00';
  const days = cleanList(body.days_of_week).map(Number).filter((d) => d >= 1 && d <= 7);
  if (frequency === 'weekly' && days.length === 0) {
    return { error: 'Pick at least one day of the week' };
  }
  const known = new Set((mod.inputFields ?? []).map((f) => f.key));
  const rawInputs = body.module_inputs && typeof body.module_inputs === 'object' ? body.module_inputs : {};
  const moduleInputs = {};
  for (const [key, value] of Object.entries(rawInputs)) {
    if (!known.has(key)) continue;
    if (value === null || value === undefined || value === '' ) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    moduleInputs[key] = value;
  }
  return { label, module, linked, frequency, time, days, moduleInputs };
}

r.get('/modules', (_req, res) => {
  res.json(
    listModules().map(({ id, label, inputFields, actorIdExample, actorEnv }) => ({
      id,
      label,
      inputFields,
      actorIdExample,
      actorEnv,
    }))
  );
});

r.get('/health', (_req, res) => {
  res.json({
    ok: true,
    apify: Boolean(config.apifyToken),
    telegram: telegramConfigured(),
    actors: { linkedin: Boolean(config.linkedinActorId), upwork: Boolean(config.upworkActorId) },
  });
});

r.get('/countries', (_req, res) => {
  res.json(db.prepare('SELECT * FROM countries ORDER BY name').all());
});

r.post('/countries', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return bad(res, 'Country name is required');
  try {
    const info = db.prepare('INSERT INTO countries (name) VALUES (?)').run(name);
    res.status(201).json(db.prepare('SELECT * FROM countries WHERE id = ?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: `"${name}" is already in the list` });
  }
});

r.delete('/countries/:id', (req, res) => {
  const info = db.prepare('DELETE FROM countries WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: 'Country not found' });
  res.json({ ok: true });
});

r.get('/searches', (_req, res) => {
  res.json(db.prepare('SELECT * FROM searches ORDER BY created_at DESC').all().map(parseSearchRow));
});

r.get('/searches/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM searches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Search not found' });
  res.json(parseSearchRow(row));
});

function searchPayload(body) {
  const keywords = cleanList(body.keywords);
  if (keywords.length === 0) return { error: 'At least one keyword is required' };
  const locations = cleanList(body.locations);
  const tags = cleanList(body.tags);
  const tf = TIME_FILTERS.includes(body.time_filter) ? body.time_filter : TIME_FILTER_DEFAULT;
  return { keywords, locations, tags, tf };
}

r.post('/searches', (req, res) => {
  const p = searchPayload(req.body ?? {});
  if (p.error) return bad(res, p.error);
  const id = uid('search');
  const now = nowIso();
  db.prepare(
    'INSERT INTO searches (id, keywords, locations, time_filter, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, JSON.stringify(p.keywords), JSON.stringify(p.locations), p.tf, JSON.stringify(p.tags), now, now);
  res.status(201).json(parseSearchRow(db.prepare('SELECT * FROM searches WHERE id = ?').get(id)));
});

r.put('/searches/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM searches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Search not found' });
  const p = searchPayload(req.body ?? {});
  if (p.error) return bad(res, p.error);
  db.prepare(
    'UPDATE searches SET keywords = ?, locations = ?, time_filter = ?, tags = ?, updated_at = ? WHERE id = ?'
  ).run(JSON.stringify(p.keywords), JSON.stringify(p.locations), p.tf, JSON.stringify(p.tags), nowIso(), req.params.id);
  res.json(parseSearchRow(db.prepare('SELECT * FROM searches WHERE id = ?').get(req.params.id)));
});

r.delete('/searches/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS c FROM triggers WHERE linked_search_id = ?').get(req.params.id).c;
  if (used > 0) {
    return res.status(409).json({ error: 'This search is linked to a trigger — delete the trigger first' });
  }
  const info = db.prepare('DELETE FROM searches WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Search not found' });
  res.json({ ok: true });
});

r.get('/triggers', (_req, res) => {
  const rows = db.prepare('SELECT * FROM triggers ORDER BY created_at DESC').all();
  const searches = Object.fromEntries(
    db.prepare('SELECT id, keywords, time_filter FROM searches').all().map((s) => {
      let parsed = null;
      try {
        parsed = { id: s.id, keywords: JSON.parse(s.keywords), time_filter: s.time_filter };
      } catch {
        parsed = { id: s.id, keywords: [], time_filter: 'week' };
      }
      return [s.id, parsed];
    })
  );
  res.json(
    rows.map((row) => {
      const t = parseTriggerRow(row);
      const s = searches[t.linked_search_id];
      return { ...t, search: s ? { id: s.id, keywords: s.keywords, time_filter: s.time_filter } : null };
    })
  );
});

r.post('/triggers', (req, res) => {
  const p = validTriggerBody(req.body ?? {});
  if (p.error) return bad(res, p.error);
  const id = uid('trigger');
  const now = nowIso();
  const next = computeNextRun(p.frequency, p.time, p.days).toISOString();
  db.prepare(
    'INSERT INTO triggers (id, label, module, linked_search_id, frequency, time, days_of_week, module_inputs, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, p.label, p.module, p.linked, p.frequency, p.time, JSON.stringify(p.days), JSON.stringify(p.moduleInputs), next, now, now);
  res.status(201).json(parseTriggerRow(db.prepare('SELECT * FROM triggers WHERE id = ?').get(id)));
});

r.put('/triggers/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM triggers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trigger not found' });
  const p = validTriggerBody(req.body ?? {});
  if (p.error) return bad(res, p.error);
  const next = computeNextRun(p.frequency, p.time, p.days).toISOString();
  db.prepare(
    'UPDATE triggers SET label = ?, module = ?, linked_search_id = ?, frequency = ?, time = ?, days_of_week = ?, module_inputs = ?, next_run_at = ?, updated_at = ? WHERE id = ?'
  ).run(p.label, p.module, p.linked, p.frequency, p.time, JSON.stringify(p.days), JSON.stringify(p.moduleInputs), next, nowIso(), req.params.id);
  res.json(parseTriggerRow(db.prepare('SELECT * FROM triggers WHERE id = ?').get(req.params.id)));
});

r.delete('/triggers/:id', (req, res) => {
  const info = db.prepare('DELETE FROM triggers WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Trigger not found' });
  res.json({ ok: true });
});

r.post('/triggers/:id/run', (req, res) => {
  const row = db.prepare('SELECT * FROM triggers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Trigger not found' });
  const trigger = parseTriggerRow(row);
  const runId = uid('run');
  fireTrigger(trigger, { manual: true, runId }).catch((e) =>
    console.error(`[run-now] trigger ${trigger.id} failed:`, e)
  );
  res.status(202).json({ runId });
});

r.get('/runs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const since = req.query.since;
  const rows = since
    ? db
        .prepare(
          'SELECT id, trigger_id, module, search_id, status, total_found, new_jobs_count, csv_file, delivery, error, started_at, finished_at FROM runs WHERE finished_at > ? ORDER BY finished_at DESC LIMIT ?'
        )
        .all(String(since), limit)
    : db
        .prepare(
          'SELECT id, trigger_id, module, search_id, status, total_found, new_jobs_count, csv_file, delivery, error, started_at, finished_at FROM runs ORDER BY started_at DESC LIMIT ?'
        )
        .all(limit);
  res.json(rows);
});

r.get('/runs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Run not found' });
  res.json({ ...row, new_jobs: JSON.parse(row.new_jobs) });
});

r.delete('/runs/:id', (req, res) => {
  const info = db.prepare('DELETE FROM runs WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Run not found' });
  res.json({ ok: true });
});

export default r;
