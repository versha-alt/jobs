import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { EASE, Icon, ModuleBadge, RawRecord, SkeletonList } from './ui.jsx';

function factsFrom(raw, job) {
  const facts = [];
  const push = (label, value) => {
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      facts.push({ label, value: value === true ? 'Yes' : String(value) });
    }
  };
  if (job?.source === 'upwork') {
    push('Budget', raw?.budget);
    push('Job type', raw?.jobType);
    push('Experience', raw?.experienceLevel);
    push('Payment verified', raw?.paymentVerified);
    push('Proposals', raw?.proposals);
    push('Hired before', raw?.hasHired);
    push('Client location', raw?.clientLocation);
    push('Client total spent', raw?.clientTotalSpent ? `$${raw.clientTotalSpent}` : null);
    push('Client rating', raw?.clientRating || null);
  } else {
    push('Salary', raw?.salary);
    push('Seniority', raw?.seniorityLevel);
    push('Employment type', raw?.employmentType);
    push('Job function', raw?.jobFunction);
    push('Industries', raw?.industries);
    push('Applicants', raw?.applicantsCount);
    push(
      'Posted by',
      raw?.jobPosterName ? `${raw.jobPosterName}${raw.jobPosterTitle ? ` — ${raw.jobPosterTitle}` : ''}` : null
    );
    push('Company size', raw?.companyEmployeesCount ? `${raw.companyEmployeesCount} employees` : null);
  }
  return facts;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function JobsDetail({ jobId, onBack, onOpenRun }) {
  const [job, setJob] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.jobs
      .get(jobId)
      .then((d) => alive && setJob(d))
      .catch(() => alive && setNotFound(true));
    return () => {
      alive = false;
    };
  }, [jobId]);

  if (notFound) {
    return (
      <div className="main">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" /> Back to jobs
        </button>
        <div className="card empty-card">Job not found — it may have been removed.</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="main">
        <SkeletonList rows={3} />
      </div>
    );
  }

  const raw = job.raw ?? {};
  const description = raw.descriptionText || raw.description || job.description || null;
  const skills = Array.isArray(raw.tags) ? raw.tags : [];
  const url = job.url || raw.link || raw.applyUrl || '';
  const facts = factsFrom(raw, job);

  const toggleFlag = async (flag) => {
    setBusy(true);
    try {
      const endpoint = flag === 'bookmarked' ? 'bookmark' : 'dismiss';
      const r = await api.jobs[endpoint](job.id);
      if (flag === 'dismissed' && r.dismissed) {
        toast.success('Job dismissed — hidden from the Active list');
        onBack();
        return;
      }
      setJob((prev) => ({ ...prev, [flag]: r[flag] ? 1 : 0 }));
      toast.success(flag === 'bookmarked' ? (r.bookmarked ? 'Job saved' : 'Removed from saved') : r.dismissed ? 'Job hidden' : 'Job restored');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="main jobs-page job-detail"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      <div className="section-head">
        <div className="jobs-page-title">
          <button type="button" className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Back to jobs">
            <Icon name="back" />
          </button>
          <h2>
            <span className="jobs-page-jobs">Job</span>
          </h2>
        </div>
        <div className="jd-header-actions">
          <button
            type="button"
            className={`btn btn-ghost btn-icon${job.bookmarked ? ' jd-flag-on' : ''}`}
            onClick={() => toggleFlag('bookmarked')}
            disabled={busy}
            aria-label={job.bookmarked ? 'Remove from saved' : 'Bookmark job'}
            title={job.bookmarked ? 'Saved — click to remove' : 'Bookmark this job'}
          >
            <span className={job.bookmarked ? 'jd-star-on' : undefined}>
              <Icon name="star" />
            </span>
          </button>
          <button
            type="button"
            className={`btn btn-icon ${job.dismissed ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => toggleFlag('dismissed')}
            disabled={busy}
            aria-label={job.dismissed ? 'Restore job' : 'Dismiss job'}
            title={job.dismissed ? 'Restore to Active' : 'Dismiss this job'}
          >
            <Icon name="xCircle" />
          </button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary jd-apply">
              Open original listing
            </a>
          )}
        </div>
      </div>

      <h1 className="jd-big-title">{job.title}</h1>
      <div className="jd-sub">
        {job.company && <span className="jd-company">{job.company}</span>}
        {job.location && <span className="pill pill-muted">{job.location}</span>}
        <ModuleBadge module={job.source} />
        {job.posted_date && <span className="muted">· posted {fmtDate(job.posted_date)}</span>}
        <span className="muted">· fetched {fmtDate(job.fetched_at)}</span>
        {job.is_new ? <span className="tag tag-new">new</span> : null}
        {job.bookmarked ? <span className="tag tag-new">saved</span> : null}
      </div>

      {skills.length > 0 && (
        <>
          <span className="jd-section-label">Skills &amp; tags</span>
          <div className="jd-tags">
            {skills.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </>
      )}

      {facts.length > 0 && (
        <>
          <span className="jd-section-label">Details</span>
          <div className="card jd-facts">
            {facts.map((f) => (
              <div className="jd-field" key={f.label}>
                <span className="jd-field-label">{f.label}</span>
                <span className="jd-field-value">{f.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <span className="jd-section-label">Description</span>
      <div className="card jd-desc-card">
        {description ? (
          <div className="jd-desc">{description}</div>
        ) : (
          <span className="muted">
            {url
              ? 'No description was stored for this job — open the original listing for full details.'
              : 'No description was recorded for this job.'}
          </span>
        )}
      </div>

      <span className="jd-section-label">Source &amp; trace</span>
      <div className="card jd-trace">
        <div className="jd-field">
          <span className="jd-field-label">Platform</span>
          <span className="jd-field-value">
            <ModuleBadge module={job.source} />
          </span>
        </div>
        <div className="jd-field">
          <span className="jd-field-label">Original listing</span>
          <span className="jd-field-value">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="job-link">
                open posting
              </a>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className="jd-field">
          <span className="jd-field-label">Date posted</span>
          <span className="jd-field-value">{job.posted_date ? fmtDate(job.posted_date) : '—'}</span>
        </div>
        <div className="jd-field">
          <span className="jd-field-label">Date fetched</span>
          <span className="jd-field-value">{fmtDate(job.fetched_at)}</span>
        </div>
        <div className="jd-field">
          <span className="jd-field-label">Originating run</span>
          <span className="jd-field-value">
            <button
              type="button"
              className="jt-run-link"
              onClick={() => onOpenRun(job.run_id)}
              title="Open this run's full job listing"
            >
              Run of {fmtDate(job.run_started_at ?? job.fetched_at)}
              {job.run_total_found ? ` · ${job.run_total_found} fetched` : ''}
            </button>
          </span>
        </div>
        <div className="jd-field">
          <span className="jd-field-label">Saved search</span>
          <span className="jd-field-value">
            {job.search_keywords.length
              ? `${job.search_keywords.join(', ')} (${job.search_time_filter ?? 'week'})`
              : '—'}
          </span>
        </div>
        <div className="jd-field">
          <span className="jd-field-label">Search locations</span>
          <span className="jd-field-value">
            {job.search_locations.length ? job.search_locations.join(', ') : '—'}
          </span>
        </div>
      </div>

      <RawRecord raw={job.raw} />
    </motion.div>
  );
}
