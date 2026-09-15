import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { EASE, Icon, ModuleBadge, RawRecord, SkeletonList, timeAgo } from './ui.jsx';

function factsFor(source, job, raw) {
  const facts = [];
  const push = (label, value) => {
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      facts.push({ label, value: value === true ? 'Yes' : String(value) });
    }
  };
  if (source === 'upwork') {
    push('Budget', raw?.budget);
    push('Job type', raw?.jobType);
    push('Experience', raw?.experienceLevel);
    push('Payment verified', raw?.paymentVerified);
    push('Proposals', raw?.proposals);
    push('Hired before', raw?.hasHired);
    push('Client location', raw?.clientLocation);
    push('Client total spent', raw?.clientTotalSpent ? `$${raw.clientTotalSpent}` : null);
    push('Client rating', raw?.clientRating || null);
    push('Posted', raw?.relativeDate ?? (job?.posted_date || '').slice(0, 10));
  } else {
    push('Salary', raw?.salary);
    push('Seniority', raw?.seniorityLevel);
    push('Employment type', raw?.employmentType);
    push('Job function', raw?.jobFunction);
    push('Industries', raw?.industries);
    push('Applicants', raw?.applicantsCount);
    push('Posted by', raw?.jobPosterName ? `${raw.jobPosterName}${raw.jobPosterTitle ? ` — ${raw.jobPosterTitle}` : ''}` : null);
    push('Company size', raw?.companyEmployeesCount ? `${raw.companyEmployeesCount} employees` : null);
    push('Posted', (job?.posted_date || raw?.postedAt || '').slice(0, 10));
  }
  return facts;
}

export default function JobDetail({ runId, jobRef, onBack }) {
  const { source, jobId } = jobRef;
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    api.runs
      .job(runId, source, jobId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setNotFound(true));
    return () => {
      alive = false;
    };
  }, [runId, source, jobId]);

  if (notFound) {
    return (
      <div className="main">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" /> Back to jobs
        </button>
        <div className="card empty-card">Job not found in this run.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="main">
        <SkeletonList rows={3} />
      </div>
    );
  }

  const { job, raw } = data;
  const title = job?.title ?? raw?.title ?? 'Untitled';
  const company = job?.company ?? raw?.companyName ?? '';
  const location = job?.location ?? raw?.location ?? '';
  const url = job?.url ?? raw?.url ?? raw?.link ?? raw?.applyUrl ?? '';
  const description = raw?.descriptionText || raw?.description || null;
  const tags = [...(raw?.tags ?? [])];
  const facts = factsFor(source, job, raw);
  const website = raw?.companyWebsite;

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
            <ModuleBadge module={source} />
            <span className="jd-title-text">{title}</span>
          </h2>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary jd-apply">
            Apply on {source === 'linkedin' ? 'LinkedIn' : 'Upwork'}
          </a>
        )}
      </div>

      <div className="jd-sub">
        {company && <span className="jd-company">{company}</span>}
        {location && <span className="muted">{location}</span>}
        {job?.posted_date && <span className="muted">· posted {(job.posted_date || '').slice(0, 10)}</span>}
        {job?.matched_keywords?.length > 0 && (
          <span className="muted">· matched “{job.matched_keywords.join(', ')}”</span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="jd-tags">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}

      {facts.length > 0 && (
        <div className="card jd-facts">
          {facts.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      )}

      {website && (
        <div className="jd-site">
          Company site:{' '}
          <a href={website} target="_blank" rel="noreferrer" className="job-link">
            {website.replace(/^https?:\/\//, '')}
          </a>
        </div>
      )}

      <div className="card jd-desc-card">
        {description ? (
          <div className="jd-desc">{description}</div>
        ) : (
          <span className="muted">
            {url
              ? 'No description was stored for this job — open the original posting for full details.'
              : 'Full details were not recorded for this run (it predates job detail storage).'}
          </span>
        )}
      </div>

      <RawRecord raw={raw} />
    </motion.div>
  );
}
