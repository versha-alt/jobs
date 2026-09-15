p = 'server/routes.js'
s = open(p, encoding='utf8').read()

s = s.replace(
    "import { Router } from 'express';",
    "import { Router } from 'express';\nimport { requireAuth, authRouter } from './auth.js';"
)

s = s.replace("r.get('/countries'", "r.get('/countries', requireAuth")
s = s.replace("r.post('/countries'", "r.post('/countries', requireAuth")
s = s.replace("r.delete('/countries/:id'", "r.delete('/countries/:id', requireAuth")
s = s.replace("r.get('/searches'", "r.get('/searches', requireAuth")
s = s.replace("r.get('/searches/:id'", "r.get('/searches/:id', requireAuth")
s = s.replace("r.post('/searches'", "r.post('/searches', requireAuth")
s = s.replace("r.put('/searches/:id'", "r.put('/searches/:id', requireAuth")
s = s.replace("r.delete('/searches/:id'", "r.delete('/searches/:id', requireAuth")
s = s.replace("r.get('/triggers',", "r.get('/triggers', requireAuth,")
s = s.replace("r.post('/triggers',", "r.post('/triggers', requireAuth,")
s = s.replace("r.put('/triggers/:id',", "r.put('/triggers/:id', requireAuth,")
s = s.replace("r.delete('/triggers/:id',", "r.delete('/triggers/:id', requireAuth,")
s = s.replace("r.post('/triggers/:id/run',", "r.post('/triggers/:id/run', requireAuth,")
s = s.replace("r.get('/runs',", "r.get('/runs', requireAuth,")
s = s.replace("r.get('/runs/:id',", "r.get('/runs/:id', requireAuth,")
s = s.replace("r.get('/runs/:id/jobs/:source/:jobId',", "r.get('/runs/:id/jobs/:source/:jobId', requireAuth,")
s = s.replace("r.delete('/runs/:id',", "r.delete('/runs/:id', requireAuth,")

s = s.replace(
    "res.json((await all('SELECT * FROM searches ORDER BY created_at DESC')).map(parseSearchRow));",
    "res.json(\n    (await all('SELECT * FROM searches WHERE user_id = ? ORDER BY created_at DESC', [req.user.id])).map(parseSearchRow)\n  );"
)
s = s.replace(
    "const row = await get('SELECT * FROM searches WHERE id = ?', [req.params.id]);\n  if (!row) return res.status(404).json({ error: 'Search not found' });\n  res.json(parseSearchRow(row));",
    "const row = await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);\n  if (!row) return res.status(404).json({ error: 'Search not found' });\n  res.json(parseSearchRow(row));"
)
s = s.replace(
    "  const id = uid('search');\n  const now = nowIso();\n  await run(\n    'INSERT INTO searches (id, keywords, locations, time_filter, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',\n    [id, JSON.stringify(p.keywords), JSON.stringify(p.locations), p.tf, JSON.stringify(p.tags), now, now]\n  );\n  res.status(201).json(parseSearchRow(await get('SELECT * FROM searches WHERE id = ?', [id])));",
    "  const id = uid('search');\n  const now = nowIso();\n  await run(\n    'INSERT INTO searches (id, user_id, keywords, locations, time_filter, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',\n    [id, req.user.id, JSON.stringify(p.keywords), JSON.stringify(p.locations), p.tf, JSON.stringify(p.tags), now, now]\n  );\n  res.status(201).json(parseSearchRow(await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [id, req.user.id])));"
)
s = s.replace(
    "const existing = await get('SELECT id FROM searches WHERE id = ?', [req.params.id]);",
    "const existing = await get('SELECT id FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);"
)
s = s.replace(
    "res.json(parseSearchRow(await get('SELECT * FROM searches WHERE id = ?', [req.params.id])));",
    "res.json(parseSearchRow(await get('SELECT * FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])));"
)
s = s.replace(
    "const result = await run('DELETE FROM searches WHERE id = ?', [req.params.id]);",
    "const result = await run('DELETE FROM searches WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);"
)

s = s.replace(
    "const rows = await all('SELECT * FROM triggers ORDER BY created_at DESC');",
    "const rows = await all('SELECT * FROM triggers WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);"
)
s = s.replace(
    "const search = await get('SELECT id FROM searches WHERE id = ?', [linked]);",
    "const search = await get('SELECT id FROM searches WHERE id = ? AND user_id = ?', [linked, req.user.id]);"
)
s = s.replace(
    "  await run(\n    'INSERT INTO triggers (id, label, module, linked_search_id, frequency, time, days_of_week, module_inputs, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',\n    [id, p.label, p.module, p.linked, p.frequency, p.time, JSON.stringify(p.days), JSON.stringify(p.moduleInputs), next, now, now]\n  );\n  res.status(201).json(parseTriggerRow(await get('SELECT * FROM triggers WHERE id = ?', [id])));",
    "  await run(\n    'INSERT INTO triggers (id, user_id, label, module, linked_search_id, frequency, time, days_of_week, module_inputs, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',\n    [id, req.user.id, p.label, p.module, p.linked, p.frequency, p.time, JSON.stringify(p.days), JSON.stringify(p.moduleInputs), next, now, now]\n  );\n  res.status(201).json(parseTriggerRow(await get('SELECT * FROM triggers WHERE id = ? AND user_id = ?', [id, req.user.id])));"
)
s = s.replace(
    "r.put('/triggers/:id', requireAuth, wrap(async (req, res) => {\n  const existing = await get('SELECT id FROM triggers WHERE id = ?', [req.params.id]);",
    "r.put('/triggers/:id', requireAuth, wrap(async (req, res) => {\n  const existing = await get('SELECT id FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);"
)
s = s.replace(
    "  res.json(parseTriggerRow(await get('SELECT * FROM triggers WHERE id = ?', [req.params.id])));",
    "  res.json(parseTriggerRow(await get('SELECT * FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])));"
)
s = s.replace(
    "  const result = await run('DELETE FROM triggers WHERE id = ?', [req.params.id]);",
    "  const result = await run('DELETE FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);"
)
s = s.replace(
    "  const row = await get('SELECT * FROM triggers WHERE id = ?', [req.params.id]);\n  if (!row) return res.status(404).json({ error: 'Trigger not found' });",
    "  const row = await get('SELECT * FROM triggers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);\n  if (!row) return res.status(404).json({ error: 'Trigger not found' });"
)

s = s.replace(
    "  const rows = since\n    ? await all(\n        `SELECT ${cols} FROM runs WHERE finished_at > ? ORDER BY finished_at DESC LIMIT ${limit}`,\n        [String(since)]\n      )\n    : await all(`SELECT ${cols} FROM runs ORDER BY started_at DESC LIMIT ${limit}`);",
    "  const rows = since\n    ? await all(\n        `SELECT ${cols} FROM runs WHERE user_id = ? AND finished_at > ? ORDER BY finished_at DESC LIMIT ${limit}`,\n        [req.user.id, String(since)]\n      )\n    : await all(`SELECT ${cols} FROM runs WHERE user_id = ? ORDER BY started_at DESC LIMIT ${limit}`, [req.user.id]);"
)
s = s.replace(
    "r.get('/runs/:id', requireAuth, wrap(async (req, res) => {\n  const row = await get(\n    'SELECT id, trigger_id, module, search_id, status, total_found, new_jobs_count, delivery, error, new_jobs, all_jobs, started_at, finished_at FROM runs WHERE id = ?',\n    [req.params.id]\n  );",
    "r.get('/runs/:id', requireAuth, wrap(async (req, res) => {\n  const row = await get(\n    'SELECT id, trigger_id, module, search_id, status, total_found, new_jobs_count, delivery, error, new_jobs, all_jobs, started_at, finished_at FROM runs WHERE id = ? AND user_id = ?',\n    [req.params.id, req.user.id]\n  );"
)
s = s.replace(
    "  const row = await get(\n    'SELECT id, all_jobs, new_jobs, raw_jobs FROM runs WHERE id = ?',\n    [id]\n  );",
    "  const row = await get(\n    'SELECT id, all_jobs, new_jobs, raw_jobs FROM runs WHERE id = ? AND user_id = ?',\n    [id, req.user.id]\n  );"
)
s = s.replace(
    "  const result = await run('DELETE FROM runs WHERE id = ?', [req.params.id]);",
    "  const result = await run('DELETE FROM runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);"
)

s = s.replace("export default r;", "export { authRouter };\nexport default r;")

open(p, 'w', encoding='utf8', newline='\n').write(s)
print('routes.js rewritten ok')
