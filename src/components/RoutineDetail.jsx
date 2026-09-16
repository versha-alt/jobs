import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { Countdown, Icon, ModuleBadge, SkeletonList, Spinner } from './ui.jsx';

const DAY_NAMES = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

function durationLabel(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  if (Number.isNaN(ms) || ms < 0) return '—';
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function Field({ label, children }) {
  return (
    <div className="jd-field">
      <span className="jd-field-label">{label}</span>
      <span className="jd-field-value">{children ?? 'Not specified'}</span>
    </div>
  );
}

function ScheduleSubForm({ initial, onAdd, onCancel }) {
  const [type, setType] = useState(initial?.type ?? 'daily');
  const [time, setTime] = useState(initial?.time ?? '09:00');
  const [days, setDays] = useState(initial?.days ?? [1]);

  const valid = type !== 'weekly' || (Array.isArray(days) && days.length > 0);

  return (
    <div className="sched-subform">
      <div className="field-grid">
        <label className="field">
          <span className="field-label">Schedule type</span>
          <select className="text-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Specific weekdays</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">{type === 'hourly' ? 'Minute past the hour' : 'Time of day'}</span>
          {type === 'hourly' ? (
            <select
              className="text-input"
              value={time.split(':')[1] ?? '00'}
              onChange={(e) => setTime(`00:${e.target.value}`)}
            >
              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                <option key={m} value={m}>
                  :{m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="time"
              className="text-input"
              value={time}
              onChange={(e) => setTime(e.target.value || '09:00')}
            />
          )}
        </label>
      </div>
      {type === 'weekly' && (
        <div className="field">
          <span className="field-label">Days of week</span>
          <div className="day-row">
            {Object.entries(DAY_NAMES).map(([n, label]) => {
              const on = days.includes(Number(n));
              return (
                <button
                  key={n}
                  type="button"
                  className={`day-btn${on ? ' on' : ''}`}
                  onClick={() =>
                    setDays(on ? days.filter((x) => x !== Number(n)) : [...days, Number(n)].sort())
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() =>
            onAdd({
              type,
              time: type === 'hourly' ? `00:${time.split(':')[1] ?? '00'}` : time,
              days: type === 'weekly' ? days : [],
            })
          }
        >
          {initial ? 'Save schedule' : 'Add schedule'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function RoutineDetail({ routineId, runId }) {
  const navigate = useNavigate();
  const [routine, setRoutine] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('details');
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null); // null | 'new' | schedule object
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const loadRoutine = useCallback(async () => {
    try {
      const r = await api.routines.get(routineId);
      setRoutine(r);
    } catch (err) {
      setNotFound(true);
    }
  }, [routineId]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.routines.runs(routineId, { page, pageSize: 15 }));
    } catch {
      setHistory({ total: 0, success: 0, failed: 0, page: 1, pageCount: 1, items: [] });
    }
  }, [routineId, page]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  useEffect(() => {
    if (runId) setTab('history');
  }, [runId]);

  if (notFound) {
    return (
      <div className="main">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/routines')}>
          <Icon name="back" size={14} /> Back to routines
        </button>
        <div className="card empty-card">Routine not found — it may have been deleted.</div>
      </div>
    );
  }
  if (!routine) return <SkeletonList rows={3} />;

  const soonest = [...(routine.schedules ?? [])]
    .filter((s) => s.active && s.next_run_at)
    .sort((a, b) => a.next_run_at.localeCompare(b.next_run_at))[0];

  const runNow = async () => {
    setRunning(true);
    try {
      await api.routines.runNow(routine.id);
      toast.success(`Run started for "${routine.name}"`);
      loadHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    try {
      await api.routines.remove(routine.id);
      toast.success('Routine deleted');
      navigate('/routines');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveSchedule = async (sched) => {
    try {
      if (editingSchedule && editingSchedule !== 'new') {
        await api.routines.removeSchedule(routine.id, editingSchedule.id);
      }
      await api.routines.addSchedule(routine.id, { ...sched, active: true });
      toast.success('Schedule saved');
      setEditingSchedule(null);
      loadRoutine();
      loadHistory();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteSchedule = async (sid) => {
    try {
      await api.routines.removeSchedule(routine.id, sid);
      toast.success('Schedule removed');
      loadRoutine();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const TABS = [
    ['details', 'Details'],
    ['schedules', `Schedules (${(routine.schedules ?? []).length})`],
    ['history', `History${history ? ` (${history.total})` : ''}`],
  ];

  return (
    <div className="main schedule-detail">
      <button type="button" className="btn btn-ghost sd-back" onClick={() => navigate('/routines')}>
        <Icon name="back" size={14} /> Back to routines
      </button>

      <div className="sd-header">
        <div className="sd-title-block">
          <h2 className="sd-title">
            {routine.name}
            <ModuleBadge module={routine.module} />
            <span className={`pill ${routine.active ? 'pill-ok' : 'pill-warn'}`}>
              {routine.active ? 'Active' : 'Inactive'}
            </span>
          </h2>
          <div className="sd-summary">
            {(routine.schedules ?? []).length
              ? `${routine.schedules.length} schedule${routine.schedules.length === 1 ? '' : 's'}`
              : 'No schedules'}
            {soonest && (
              <>
                {' · '}next <Countdown iso={soonest.next_run_at} />
              </>
            )}
            {' · '}
            <span className="sd-kw">{routine.keywords.join(', ')}</span>
          </div>
        </div>
        <div className="sd-actions">
          <button type="button" className="btn btn-primary" onClick={runNow} disabled={running}>
            {running ? <Spinner /> : <Icon name="play" size={14} />}
            Run now
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/routines/${routine.id}/edit`)}
          >
            <Icon name="edit" size={14} /> Edit
          </button>
          <button
            type="button"
            className={`btn btn-icon ${confirming ? 'btn-danger' : 'btn-ghost'}`}
            onClick={remove}
            aria-label="Delete routine"
          >
            {confirming ? 'Sure?' : <Icon name="trash" />}
          </button>
        </div>
      </div>

      {runId ? (
        <RunInspect routineId={routineId} runId={runId} />
      ) : (
        <>
          <nav className="tabs sd-tabs">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`tab${tab === id ? ' active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === 'details' && (
            <div className="card jd-facts sd-meta">
              <Field label="Module">
                <ModuleBadge module={routine.module} />
              </Field>
              <Field label="Keywords">{routine.keywords.join(', ') || 'Not specified'}</Field>
              <Field label="Locations">
                {routine.locations.length ? routine.locations.join(', ') : 'Not specified'}
              </Field>
              <Field label="Tags">
                {routine.tags.length ? routine.tags.join(', ') : 'Not specified'}
              </Field>
              <Field label="Volume per run">{routine.volume_per_run}</Field>
              <Field label="Total runs">{history ? history.total : '…'}</Field>
              <Field label="Successful runs">{history ? history.success : '…'}</Field>
              <Field label="Failed runs">{history ? history.failed : '…'}</Field>
              <Field label="Created">{fmtDateTime(routine.created_at)}</Field>
              <Field label="Modified">{fmtDateTime(routine.updated_at)}</Field>
            </div>
          )}

          {tab === 'schedules' && (
            <div className="card sd-trigger">
              {(routine.schedules ?? []).length === 0 && (
                <span className="muted">No schedules — this routine will not run on its own.</span>
              )}
              {(routine.schedules ?? []).map((s) => (
                <div className="sched-item" key={s.id}>
                  <span className="sched-label">
                    {s.type === 'hourly'
                      ? `Hourly at :${s.time.split(':')[1]}`
                      : s.type === 'daily'
                        ? `Every day at ${s.time}`
                        : `${(s.days ?? []).map((d) => DAY_NAMES[d]).join(', ') || 'No days'} at ${s.time}`}
                    {s.active && s.next_run_at ? ` · next ${fmtDateTime(s.next_run_at)}` : ''}
                  </span>
                  <span className="dl-actions" style={{ opacity: 1 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => setEditingSchedule(s)}
                      title="Edit schedule"
                      aria-label="Edit schedule"
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => deleteSchedule(s.id)}
                      title="Delete schedule"
                      aria-label="Delete schedule"
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              ))}
              {editingSchedule ? (
                <ScheduleSubForm
                  initial={editingSchedule === 'new' ? undefined : editingSchedule}
                  onAdd={(sched) => saveSchedule(sched)}
                  onCancel={() => setEditingSchedule(null)}
                />
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost rf-add-sched"
                  onClick={() => setEditingSchedule('new')}
                >
                  <Icon name="plus" size={14} /> Add schedule
                </button>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="datalist">
              <div className="dl-head dl-head-hist" aria-hidden="true">
                <span className="dl-h-label">Started</span>
                <span className="dl-h-label">Status</span>
                <span className="dl-h-label dl-h-actions">Fetched</span>
                <span className="dl-h-label dl-h-actions">Duration</span>
                <span className="dl-h-label dl-h-actions" />
              </div>
              {history && history.items.length === 0 && (
                <div className="empty-filter-card">
                  <p className="empty-filter-title">No runs yet for this routine</p>
                  <p className="empty-filter-hint">
                    Trigger one with "Run now", or wait for the next scheduled fire.
                  </p>
                </div>
              )}
              {(history?.items ?? []).map((r) => (
                <div
                  key={r.id}
                  className={`dl-row dl-row-hist${runId === r.id ? ' dl-row-open' : ''}`}
                  onClick={() => navigate(`/routines/${routineId}/history/${r.id}`)}
                >
                  <span className="dl-meta">{fmtDateTime(r.started_at)}</span>
                  <span
                    className={`pill ${r.status === 'success' ? 'pill-ok' : r.status === 'error' ? 'pill-err' : 'pill-warn'}`}
                  >
                    {r.status === 'error' ? 'failed' : r.status}
                    {r.manual ? ' · manual' : ''}
                  </span>
                  <span className="dl-meta dl-h-actions">{r.total_found}</span>
                  <span className="dl-meta dl-h-actions">{durationLabel(r.started_at, r.finished_at)}</span>
                  <span className="dl-actions dl-h-actions">
                    <Icon name="chevron" size={14} />
                  </span>
                </div>
              ))}
              {history && history.pageCount > 1 && (
                <div className="dl-footer">
                  <span className="dl-range">{history.total} runs</span>
                  <div className="dl-pager">
                    <button
                      type="button"
                      className="dl-page-btn"
                      disabled={history.page === 1}
                      onClick={() => setPage(history.page - 1)}
                      aria-label="Previous page"
                    >
                      <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                        <Icon name="chevron" size={13} />
                      </span>
                    </button>
                    <span className="dl-range">
                      Page {history.page} of {history.pageCount}
                    </span>
                    <button
                      type="button"
                      className="dl-page-btn"
                      disabled={history.page === history.pageCount}
                      onClick={() => setPage(history.page + 1)}
                      aria-label="Next page"
                    >
                      <Icon name="chevron" size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RunInspect({ routineId, runId }) {
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [recPage, setRecPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    let alive = true;
    api.runs
      .get(runId)
      .then((d) => alive && setRun(d))
      .catch(() => alive && setNotFound(true));
    return () => {
      alive = false;
    };
  }, [runId]);

  if (notFound) return <div className="card empty-card">Run not found.</div>;
  if (!run) return <SkeletonList rows={3} />;

  const records = run.all_jobs ?? run.new_jobs ?? [];
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(recPage, pageCount);
  const recs = records.slice((safePage - 1) * pageSize, safePage * pageSize);

  const logLines = [
    { t: run.started_at, msg: `Run started — ${run.manual ? 'manual (Run now)' : 'scheduled trigger'}` },
    {
      t: run.started_at,
      msg: `Scraped ${run.total_found} listing(s) from ${run.module === 'linkedin' ? 'LinkedIn' : 'Upwork'}`,
    },
    ...(run.error ? [{ t: run.started_at, msg: `Failed: ${run.error}` }] : []),
    ...(run.finished_at
      ? [
          { t: run.finished_at, msg: `Fetched ${run.total_found} — new after dedup: ${run.new_jobs_count}` },
          {
            t: run.finished_at,
            msg:
              run.delivery === 'sent'
                ? 'Telegram summary delivered'
                : run.delivery === 'skipped'
                  ? 'No delivery needed'
                  : run.delivery === 'not_configured'
                    ? 'Telegram not configured — delivery skipped'
                    : `Delivery: ${run.delivery}`,
          },
        ]
      : [{ t: null, msg: 'Run still in progress…' }]),
  ].filter((l) => l.t !== null || l.msg.includes('progress'));

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost sd-back"
        onClick={() => navigate(`/routines/${routineId}`)}
      >
        <Icon name="back" size={14} /> Back to run history
      </button>
      <h3 className="sd-run-title">Run summary{run.status === 'error' ? ' (failed)' : ''}</h3>
      <div className="card jd-facts sd-meta">
        <Field label="Started">{fmtDateTime(run.started_at)}</Field>
        <Field label="Finished">{fmtDateTime(run.finished_at)}</Field>
        <Field label="Duration">{durationLabel(run.started_at, run.finished_at)}</Field>
        <Field label="Status">
          <span
            className={`pill ${run.status === 'success' ? 'pill-ok' : run.status === 'error' ? 'pill-err' : 'pill-warn'}`}
          >
            {run.status}
          </span>
        </Field>
        <Field label="Triggered by">
          {run.manual ? 'Manual ("Run now")' : 'Schedule'}
          {run.trigger_label ? ` — ${run.trigger_label}` : ''}
        </Field>
        <Field label="Fetched / New">
          {run.total_found} / {run.new_jobs_count}
        </Field>
      </div>

      <span className="jd-section-label">Execution log</span>
      <div className="card sd-log">
        {logLines.map((l, i) => (
          <div className="sd-log-line" key={i}>
            <span className="sd-log-t">{l.t ? fmtDateTime(l.t) : '…'}</span>
            <span className="sd-log-msg">{l.msg}</span>
          </div>
        ))}
      </div>

      <span className="jd-section-label">Records fetched ({records.length})</span>
      <div className="card jt-wrap">
        <table className="jt-table">
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Title</th>
              <th style={{ width: '18%' }}>Company</th>
              <th style={{ width: '10%' }}>Platform</th>
              <th style={{ width: '22%' }}>Location</th>
              <th style={{ width: '16%' }}>Posted</th>
            </tr>
          </thead>
          <tbody>
            {recs.length === 0 ? (
              <tr>
                <td colSpan={5} className="jt-muted">
                  No records stored for this run.
                </td>
              </tr>
            ) : (
              recs.map((j) => (
                <tr key={`${j.source}_${j.job_id}`}>
                  <td className="jt-title-cell">{j.title}</td>
                  <td className="jt-muted">{j.company || '—'}</td>
                  <td>
                    <span className={`badge badge-${j.source}`}>
                      {j.source === 'linkedin' ? 'LinkedIn' : 'Upwork'}
                    </span>
                  </td>
                  <td className="jt-muted">{j.location || '—'}</td>
                  <td className="jt-muted jt-date">{fmtDate(j.posted_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="dl-footer">
          <span className="dl-range">
            Page {safePage} of {pageCount}
          </span>
          <div className="dl-pager">
            <button
              type="button"
              className="dl-page-btn"
              disabled={safePage === 1}
              onClick={() => setRecPage(safePage - 1)}
              aria-label="Previous page"
            >
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                <Icon name="chevron" size={13} />
              </span>
            </button>
            <span className="dl-range">
              Page {safePage} of {pageCount}
            </span>
            <button
              type="button"
              className="dl-page-btn"
              disabled={safePage === pageCount}
              onClick={() => setRecPage(safePage + 1)}
              aria-label="Next page"
            >
              <Icon name="chevron" size={13} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}
