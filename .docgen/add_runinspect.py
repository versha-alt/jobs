p = 'src/components/ScheduleDetail.jsx'
s = open(p, encoding='utf8').read()

inspect = '''function RunInspect({ scheduleId, runId }) {
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

'''
s = s.replace('export default function ScheduleDetail(', inspect + 'export default function ScheduleDetail(', 1)

old = '''      <nav className="tabs sd-tabs">
        {TABS.map(([id, label]) => ('''
new = '''      {runId ? (
        <RunInspect scheduleId={scheduleId} runId={runId} />
      ) : (
      <>
      <nav className="tabs sd-tabs">
        {TABS.map(([id, label]) => ('''
assert old in s, 'tabs nav anchor missing'
s = s.replace(old, new)

old = '''          {history && history.pageCount > 1 && (
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
    </div>
  );
}'''
new = '''          {history && history.pageCount > 1 && (
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
}'''
assert old in s, 'closing anchor missing'
s = s.replace(old, new)

open(p, 'w', encoding='utf8', newline='\n').write(s)
print('RunInspect added')
