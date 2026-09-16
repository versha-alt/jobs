import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { Countdown, Icon, ModuleBadge, SkeletonList, Spinner } from './ui.jsx';
import { TriggerForm } from './Triggers.jsx';

const DAY_NAMES = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

function scheduleSummary(t) {
  if (t.frequency === 'hourly') return `Every hour at :${t.time.split(':')[1]}`;
  if (t.frequency === 'daily') return `Every day at ${t.time}`;
  return `${(t.days_of_week ?? []).map((d) => DAY_NAMES[d]).join(', ')} at ${t.time}`;
}

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

function RunInspect({ scheduleId, runId }) {
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

  if (notFound) {
    return <div className="card empty-card">Run not found.</div>;
  }
  if (!run) return <SkeletonList rows={3} />;

  const records = run.all_jobs ?? run.new_jobs ?? [];
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(recPage, pageCount);
  const recs = records.slice((safePage - 1) * pageSize, safePage * pageSize);

  const logLines = [
    { t: run.started_at, msg: `Run started - ${run.manual ? 'manual (Run now)' : 'scheduled trigger'}` },
    { t: run.started_at, msg: `Scraped ${run.total_found} listing(s) from ${run.module === 'linkedin' ? 'LinkedIn' : 'Upwork'}` },
    ...(run.error ? [{ t: run.started_at, msg: `Failed: ${run.error}` }] : []),
    ...(run.finished_at
      ? [
          { t: run.finished_at, msg: `Fetched ${run.total_found} - new after dedup: ${run.new_jobs_count}` },
          {
            t: run.finished_at,
            msg:
              run.delivery === 'sent'
                ? 'Telegram summary delivered'
                : run.delivery === 'skipped'
                  ? 'No delivery needed'
                  : run.delivery === 'not_configured'
                    ? 'Telegram not configured - delivery skipped'
                    : `Delivery: ${run.delivery}`,
          },
        ]
      : [{ t: null, msg: 'Run still in progress...' }]),
  ].filter((l) => l.t !== null || l.msg.includes('progress'));

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost sd-back"
        onClick={() => navigate(`/schedule/${scheduleId}`)}
      >
        <Icon name="back" size={14} /> Back to run history
      </button>
      <h3 className="sd-run-title">
        Run summary{run.status === 'error' ? ' (failed)' : ''}
      </h3>
      <div className="card jd-facts sd-meta">
        <Field label="Started">{fmtDateTime(run.started_at)}</Field>
        <Field label="Finished">{fmtDateTime(run.finished_at)}</Field>
        <Field label="Duration">{durationLabel(run.started_at, run.finished_at)}</Field>
        <Field label="Status">
          <span className={`pill ${run.status === 'success' ? 'pill-ok' : run.status === 'error' ? 'pill-err' : 'pill-warn'}`}>
            {run.status}
          </span>
        </Field>
        <Field label="Triggered by">
          {run.manual ? 'Manual ("Run now")' : 'Schedule'}
          {run.trigger_label ? ` - ${run.trigger_label}` : ''}
        </Field>
        <Field label="Fetched / New">
          {run.total_found} / {run.new_jobs_count}
        </Field>
      </div>

      <span className="jd-section-label">Execution log</span>
      <div className="card sd-log">
        {logLines.map((l, i) => (
          <div className="sd-log-line" key={i}>
            <span className="sd-log-t">{l.t ? fmtDateTime(l.t) : '...'}</span>
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
                <tr key={j.source + '_' + j.job_id}>
                  <td className="jt-title-cell">{j.title}</td>
                  <td className="jt-muted">{j.company || '-'}</td>
                  <td>
                    <span className={'badge badge-' + j.source}>
                      {j.source === 'linkedin' ? 'LinkedIn' : 'Upwork'}
                    </span>
                  </td>
                  <td className="jt-muted">{j.location || '-'}</td>
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
            <button type="button" className="dl-page-btn" disabled={safePage === 1} onClick={() => setRecPage(safePage - 1)} aria-label="Previous page">
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                <Icon name="chevron" size={13} />
              </span>
            </button>
            <button type="button" className="dl-page-btn" disabled={safePage === pageCount} onClick={() => setRecPage(safePage + 1)} aria-label="Next page">
              <Icon name="chevron" size={13} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ScheduleDetail({ searches, onRunStarted }) {
  const { scheduleId, runId } = useParams();
  const navigate = useNavigate();
  const [trigger, setTrigger] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('details');
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const loadTrigger = useCallback(async () => {
    try {
      const rows = await api.triggers.list();
      const t = rows.find((x) => x.id === scheduleId);
      if (!t) return setNotFound(true);
      setTrigger(t);
    } catch (err) {
      toast.error(err.message);
    }
  }, [scheduleId]);

  const loadHistory = useCallback(async () => {
    try {
      const h = await api.triggers.runs(scheduleId, { page, pageSize: 15 });
      setHistory(h);
    } catch {
      setHistory({ total: 0, success: 0, failed: 0, page: 1, pageCount: 1, items: [] });
    }
  }, [scheduleId, page]);

  useEffect(() => {
    loadTrigger();
  }, [loadTrigger]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // nested run view: /schedule/:id/history/:runId
  useEffect(() => {
    if (runId) setTab('history');
  }, [runId]);

  if (notFound) {
    return (
      <div className="main">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
          <Icon name="back" /> Back to scheduling
        </button>
        <div className="card empty-card">Schedule not found — it may have been deleted.</div>
      </div>
    );
  }
  if (!trigger) return <SkeletonList rows={3} />;

  const active = Boolean(trigger.next_run_at);
  const linkedSearch = trigger.search;

  const runNow = async () => {
    setRunning(true);
    try {
      const { runId: rid } = await api.triggers.runNow(trigger.id);
      toast.success(`Run started for “${trigger.label}”`);
      onRunStarted && onRunStarted(rid, trigger.id);
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
      await api.triggers.remove(trigger.id);
      toast.success('Schedule deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const TABS = [
    ['details', 'Details'],
    ['trigger', 'Trigger'],
    ['history', `History${history ? ` (${history.total})` : ''}`],
  ];

  return (
    <div className="main schedule-detail">
      <button type="button" className="btn btn-ghost sd-back" onClick={() => navigate('/dashboard')}>
        <Icon name="back" size={14} /> Back to scheduling
      </button>

      <div className="sd-header">
        <div className="sd-title-block">
          <h2 className="sd-title">
            {trigger.label}
            <ModuleBadge module={trigger.module} />
            <span className={`pill ${active ? 'pill-ok' : 'pill-warn'}`}>{active ? 'Active' : 'Inactive'}</span>
          </h2>
          <div className="sd-summary">
            {scheduleSummary(trigger)}
            {trigger.next_run_at && (
              <>
                {' · '}next <Countdown iso={trigger.next_run_at} />
              </>
            )}
            {linkedSearch && <> {' · '}<span className="sd-kw">{linkedSearch.keywords.join(', ')}</span></>}
          </div>
        </div>
        <div className="sd-actions">
          <button type="button" className="btn btn-primary" onClick={runNow} disabled={running}>
            {running ? <Spinner /> : <Icon name="play" size={14} />}
            Run now
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} /> Edit
          </button>
          <button type="button" className={`btn btn-icon ${confirming ? 'btn-danger' : 'btn-ghost'}`} onClick={remove} aria-label="Delete schedule">
            {confirming ? 'Sure?' : <Icon name="trash" />}
          </button>
        </div>
      </div>

      {runId ? (
        <RunInspect scheduleId={scheduleId} runId={runId} />
      ) : (
      <>
      <nav className="tabs sd-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? ' active' : ''}`}
            onClick={() => {
              setTab(id);
              if (runId) navigate(`/schedule/${scheduleId}`);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'details' && (
        <div className="card jd-facts sd-meta">
          <Field label="Linked search">
            {linkedSearch ? (
              <span>
                {linkedSearch.keywords.join(', ')}
                {linkedSearch.locations?.length ? ` · ${linkedSearch.locations.join(', ')}` : ''}
                {linkedSearch.time_filter ? ` · ${linkedSearch.time_filter}` : ''}
              </span>
            ) : (
              'Not specified'
            )}
          </Field>
          <Field label="Module">{trigger.module === 'linkedin' ? 'LinkedIn' : 'Upwork'}</Field>
          <Field label="Total runs">{history ? history.total : '…'}</Field>
          <Field label="Successful runs">{history ? history.success : '…'}</Field>
          <Field label="Failed runs">{history ? history.failed : '…'}</Field>
          <Field label="Created">{fmtDateTime(trigger.created_at)}</Field>
          <Field label="Modified">{fmtDateTime(trigger.updated_at)}</Field>
        </div>
      )}

      {tab === 'trigger' && (
        <div className="card sd-trigger">
          {editing ? (
            <TriggerForm
              mode="edit"
              initial={trigger}
              searches={searches}
              onDone={() => {
                setEditing(false);
                loadTrigger();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="jd-field">
                <span className="jd-field-label">Type</span>
                <span className="jd-field-value">
                  {trigger.frequency === 'hourly'
                    ? 'Hourly'
                    : trigger.frequency === 'daily'
                      ? 'Daily'
                      : 'Weekly'}
                </span>
              </div>
              <div className="jd-field">
                <span className="jd-field-label">Time</span>
                <span className="jd-field-value">{trigger.time} (server local time)</span>
              </div>
              <div className="jd-field">
                <span className="jd-field-label">Days</span>
                <span className="jd-field-value">
                  {(trigger.days_of_week ?? []).map((d) => DAY_NAMES[d]).join(', ') || 'Every day'}
                </span>
              </div>
              <div className="jd-field">
                <span className="jd-field-label">Activate immediately</span>
                <span className="jd-field-value">{trigger.next_run_at ? 'Active — next run scheduled' : 'Inactive'}</span>
              </div>
              <div className="sd-trigger-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
                  <Icon name="edit" size={14} /> Edit trigger
                </button>
              </div>
            </>
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
              <p className="empty-filter-title">No runs yet for this schedule</p>
              <p className="empty-filter-hint">Trigger one with “Run now”, or wait for the next scheduled fire.</p>
            </div>
          )}
          {(history?.items ?? []).map((r) => (
            <div
              key={r.id}
              className={`dl-row dl-row-hist${runId === r.id ? ' dl-row-open' : ''}`}
              onClick={() => navigate(`/schedule/${scheduleId}/history/${r.id}`)}
            >
              <span className="dl-meta">{fmtDateTime(r.started_at)}</span>
              <span className={`pill ${r.status === 'success' ? 'pill-ok' : r.status === 'error' ? 'pill-err' : 'pill-warn'}`}>
                {r.status === 'success' ? 'success' : r.status === 'error' ? 'failed' : r.status}
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
                <button type="button" className="dl-page-btn" disabled={history.page === 1} onClick={() => setPage(history.page - 1)} aria-label="Previous page">
                  <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                    <Icon name="chevron" size={13} />
                  </span>
                </button>
                <span className="dl-range">Page {history.page} of {history.pageCount}</span>
                <button type="button" className="dl-page-btn" disabled={history.page === history.pageCount} onClick={() => setPage(history.page + 1)} aria-label="Next page">
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
