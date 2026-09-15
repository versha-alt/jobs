import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { EASE, Icon, ModuleBadge, SkeletonList, timeAgo } from './ui.jsx';

function postedLabel(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function RunJobs({ runId, onBack, searchLabel, onOpenJob }) {
  const [run, setRun] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await api.runs.get(runId);
        if (alive) {
          setRun(r);
          setNotFound(false);
        }
      } catch (err) {
        if (alive && !run) setNotFound(true);
      }
    };
    load();
    // keep a live run's listing fresh
    const t = run && run.status === 'running' ? setInterval(load, 2000) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [runId, run && run.status]);

  if (notFound) {
    return (
      <div className="main">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" /> Back to runs
        </button>
        <div className="card empty-card">Run not found — it may have been deleted.</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="main">
        <SkeletonList rows={3} />
      </div>
    );
  }

  const full = run.all_jobs;
  const jobs = full ?? run.new_jobs ?? [];
  const newIds = new Set((run.new_jobs ?? []).map((j) => `${j.source}_${j.job_id}`));
  const partial = !full && run.new_jobs_count > 0;

  return (
    <motion.div
      className="main jobs-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      <div className="section-head">
        <div className="jobs-page-title">
          <button type="button" className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Back to runs">
            <Icon name="back" />
          </button>
          <h2>
            <ModuleBadge module={run.module} />
            {searchLabel ? <span className="jobs-page-kw">{searchLabel}</span> : null}
            <span className="jobs-page-jobs">jobs</span>
          </h2>
        </div>
        <div className="section-actions">
          <span className="muted">{timeAgo(run.finished_at || run.started_at)}</span>
        </div>
      </div>

      <div className="jobs-page-meta">
        <span className="pill pill-muted">{run.total_found} fetched</span>
        <span className={`pill ${run.new_jobs_count > 0 ? 'pill-ok' : 'pill-muted'}`}>{run.new_jobs_count} new</span>
        <span className={`pill ${run.status === 'success' ? 'pill-ok' : run.status === 'error' ? 'pill-err' : 'pill-warn'}`}>
          {run.status}
        </span>
        {run.trigger_label && (
          <span className="pill pill-muted" title={run.manual ? 'Started manually via Run now' : 'Started by its schedule'}>
            {run.trigger_label} · {run.manual ? 'manual' : 'scheduled'}
          </span>
        )}
        {run.started_at && run.finished_at && (
          <span className="pill pill-muted">
            {(() => {
              const ms = new Date(run.finished_at) - new Date(run.started_at);
              if (Number.isNaN(ms) || ms < 0) return null;
              if (ms < 1000) return '<1s';
              if (ms < 60000) return `${Math.round(ms / 1000)}s`;
              return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
            })()}
          </span>
        )}
        {run.status === 'running' && <span className="spinner" aria-hidden="true" />}
        {jobs.length > 0 && onOpenJob && <span className="muted jobs-hint">click a job for details</span>}
      </div>

      {run.status === 'error' && run.error && <div className="error-banner-hint">{run.error}</div>}
      {partial && (
        <div className="jobs-page-note">
          This run predates full job listings — showing only the {run.new_jobs_count} new job
          {run.new_jobs_count === 1 ? '' : 's'} recorded at the time.
        </div>
      )}

      <div className="card jobs-page-card">
        {jobs.length === 0 ? (
          <span className="muted">
            {run.status === 'running' ? 'Run still in progress — jobs will appear here.' : 'No jobs were fetched in this run.'}
          </span>
        ) : (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Location</th>
                <th>Posted</th>
                <th>Keyword</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const isNew = newIds.has(`${j.source}_${j.job_id}`);
                return (
                  <tr
                    key={`${j.source}_${j.job_id}`}
                    className={onOpenJob ? 'jd-row jd-row-click' : 'jd-row'}
                    onClick={onOpenJob ? () => onOpenJob(run, j) : undefined}
                  >
                    <td>
                      <span className="jd-title-link">
                        {j.title}
                      </span>
                      {isNew && <span className="tag tag-new">new</span>}
                    </td>
                    <td>{j.company}</td>
                    <td>{j.location}</td>
                    <td>{postedLabel(j.posted_date)}</td>
                    <td>{(j.matched_keywords ?? []).join(', ')}</td>
                    <td>
                      {j.url && (
                        <a href={j.url} target="_blank" rel="noreferrer" className="job-link">
                          open
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}
