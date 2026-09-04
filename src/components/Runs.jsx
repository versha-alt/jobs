import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { classifyError } from '../errors.js';
import {
  Collapsible,
  CountUp,
  EASE,
  EmptyState,
  Icon,
  Segmented,
  SkeletonList,
  timeAgo,
} from './ui.jsx';

function DeliveryBadge({ delivery }) {
  if (delivery === 'running') return <span className="pill pill-muted">running…</span>;
  if (!delivery || delivery === 'skipped') {
    return <span className="pill pill-muted">no new jobs</span>;
  }
  if (delivery === 'sent') return <span className="pill pill-ok">CSV sent to Telegram</span>;
  if (delivery === 'not_configured') return <span className="pill pill-warn">Telegram not configured</span>;
  if (delivery.startsWith('failed')) return <span className="pill pill-err">Delivery failed</span>;
  return <span className="pill pill-err">{delivery}</span>;
}

function RunCard({ run, searchLabel, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const remove = async (e) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    try {
      await api.runs.remove(run.id);
      toast.success('Run deleted');
      onDeleted(run.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (!open || jobs || !run.new_jobs_count) return undefined;
    let alive = true;
    setLoadingJobs(true);
    api
      .runs
      .get(run.id)
      .then((r) => {
        if (alive) setJobs(r.new_jobs);
      })
      .catch(() => {
        if (alive) setJobs([]);
      })
      .finally(() => {
        if (alive) setLoadingJobs(false);
      });
    return () => {
      alive = false;
    };
  }, [open, jobs, run.id, run.new_jobs_count]);

  const failed = run.status === 'error';
  const quiet = !failed && run.status === 'success' && run.new_jobs_count === 0;

  let failure = null;
  if (failed) {
    failure = { message: run.error };
  } else if (typeof run.delivery === 'string' && run.delivery.startsWith('failed')) {
    failure = { message: run.delivery.slice('failed'.length).replace(/^[:\s]+/, '') };
  }
  const cls = failure ? classifyError(failure.message) : null;
  const hasError = Boolean(failure);

  return (
    <motion.div layout className={`card run-card${hasError ? ' run-error' : ''}${quiet ? ' run-quiet' : ''}`}>
      <div className="run-head" onClick={() => setOpen(!open)}>
        <span className={`dot dot-${hasError ? 'error' : 'ok'}`} />
        <span className="run-label">{run.module === 'linkedin' ? 'LinkedIn' : 'Upwork'}</span>
        <span className="run-count">
          {failed ? (
            <span className="err-text">failed</span>
          ) : (
            <>
              <CountUp value={run.new_jobs_count} /> new
            </>
          )}
        </span>
        {searchLabel && <span className="meta run-search">{searchLabel}</span>}
        <span className="muted run-time">{timeAgo(run.finished_at || run.started_at)}</span>
        <button
          type="button"
          className={`btn btn-icon ${confirming ? 'btn-danger' : 'btn-ghost'}`}
          onClick={remove}
          aria-label="Delete run"
          title="Delete run"
        >
          {confirming ? 'Sure?' : <Icon name="trash" />}
        </button>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="run-chevron">
          <Icon name="chevron" />
        </motion.span>
      </div>
      <div className="meta-row run-meta">
        <span className="meta">{run.total_found} fetched</span>
        <DeliveryBadge delivery={run.delivery} />
      </div>
      {failure && (
        <div className="error-banner">
          <div className="error-banner-head">
            <Icon name="alert" size={14} />
            <span>{cls.title}</span>
          </div>
          <div className="error-banner-hint">{cls.hint}</div>
          <button
            type="button"
            className="error-banner-raw"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Hide technical details' : 'Show technical details'}
          </button>
          {showRaw && <div className="error-banner-raw-text">{failure.message}</div>}
        </div>
      )}
      <Collapsible open={open}>
        <div className="card-body">
          {loadingJobs ? (
            <SkeletonList rows={1} />
          ) : jobs && jobs.length > 0 ? (
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Tags</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={`${j.source}_${j.job_id}`}>
                    <td>{j.title}</td>
                    <td>{j.company}</td>
                    <td>{j.location}</td>
                    <td>
                      {j.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </td>
                    <td>
                      {j.url && (
                        <a href={j.url} target="_blank" rel="noreferrer" className="job-link">
                          open
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="muted">No job details recorded for this run.</span>
          )}
        </div>
      </Collapsible>
    </motion.div>
  );
}

export default function Runs({ runs, loading, reload, searches = [] }) {
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [removedIds, setRemovedIds] = useState(() => new Set());

  const handleDeleted = (id) => setRemovedIds((prev) => new Set(prev).add(id));

  useEffect(() => {
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, [reload]);

  const searchMap = useMemo(
    () => Object.fromEntries((searches ?? []).map((s) => [s.id, s.keywords.join(', ')])),
    [searches]
  );

  const list = (runs ?? [])
    .filter((r) => !removedIds.has(r.id))
    .filter((r) => {
    if (moduleFilter !== 'all' && r.module !== moduleFilter) return false;
    if (statusFilter === 'new' && !(r.status === 'success' && r.new_jobs_count > 0)) return false;
    if (statusFilter === 'empty' && !(r.status === 'success' && r.new_jobs_count === 0)) return false;
    if (statusFilter === 'failed' && r.status !== 'error') return false;
    return true;
  });

  return (
    <div>
      <div className="section-head">
        <h2>Run history</h2>
        <div className="section-actions">
          <span className="muted">
            {runs ? (list.length !== runs.length ? `${list.length} of ${runs.length}` : `${runs.length}`) : ''}
          </span>
          <button type="button" className="btn btn-ghost" onClick={reload}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : !runs || runs.length === 0 ? (
        <EmptyState
          icon="zap"
          title="No runs yet"
          hint="Trigger a run manually from Scheduling, or wait for the next scheduled fire."
        />
      ) : (
        <>
          <div className="toolbar">
            <Segmented
              value={moduleFilter}
              onChange={setModuleFilter}
              options={[
                { value: 'all', label: 'All modules' },
                { value: 'linkedin', label: 'LinkedIn' },
                { value: 'upwork', label: 'Upwork' },
              ]}
            />
            <Segmented
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'new', label: 'New jobs' },
                { value: 'empty', label: 'Empty' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <div className="empty-filter">No runs match the current filters</div>
          ) : (
            <div className="run-list">
              <AnimatePresence initial={false}>
                {list.map((r) => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <RunCard
                      run={r}
                      searchLabel={searchMap[r.search_id] ?? ''}
                      onDeleted={handleDeleted}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
