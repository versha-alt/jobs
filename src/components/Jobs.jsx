import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { EmptyFilter, EmptyState, FilterDropdown, Icon, SkeletonRows } from './ui.jsx';

const PAGE_SIZES = [25, 50, 100];

const PERIODS = [
  ['any', 'Any time'],
  ['24h', 'Last 24 hours'],
  ['week', 'Last week'],
  ['month', 'Last month'],
  ['custom', 'Custom range'],
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'bookmarked', label: 'Bookmarked' },
  { value: 'dismissed', label: 'Dismissed' },
];

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All platforms' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'upwork', label: 'Upwork' },
];

const COLUMNS = [
  { key: 'title', label: 'Title', sort: 'title' },
  { key: 'company', label: 'Company', sort: 'company' },
  { key: 'platform', label: 'Platform', sort: null },
  { key: 'location', label: 'Location', sort: null },
  { key: 'posted', label: 'Date posted', sort: 'posted' },
  { key: 'fetched', label: 'Date fetched', sort: 'fetched' },
  { key: 'source', label: 'Source run / search', sort: null },
  { key: 'actions', label: '', sort: null },
];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function relTime(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Jobs({ routines, onOpenJob, onOpenRun }) {
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [source, setSource] = useState('all');
  const [searchId, setSearchId] = useState('all');
  const [runId, setRunId] = useState('all');
  const [location, setLocation] = useState('');
  const [postedPeriod, setPostedPeriod] = useState('any');
  const [postedFrom, setPostedFrom] = useState('');
  const [postedTo, setPostedTo] = useState('');
  const [fetchedPeriod, setFetchedPeriod] = useState('any');
  const [fetchedFrom, setFetchedFrom] = useState('');
  const [fetchedTo, setFetchedTo] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState({ key: 'fetched', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runsList, setRunsList] = useState([]);

  // list of the user's runs for the run filter dropdown
  useEffect(() => {
    let alive = true;
    api.runs
      .list(100)
      .then((rows) => {
        if (alive) setRunsList(rows.filter((r) => r.total_found > 0));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const sortKey = `${sort.key}_${sort.dir}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = { page, pageSize, sort: sortKey, status };
        if (query.trim()) params.q = query.trim();
        if (source !== 'all') params.source = source;
        if (searchId !== 'all') params.searchId = searchId;
        if (runId !== 'all') params.runId = runId;
        if (location.trim()) params.location = location.trim();
        params.postedPeriod = postedPeriod;
        if (postedPeriod === 'custom') {
          params.postedFrom = postedFrom;
          params.postedTo = postedTo;
        }
        params.fetchedPeriod = fetchedPeriod;
        if (fetchedPeriod === 'custom') {
          params.fetchedFrom = fetchedFrom;
          params.fetchedTo = fetchedTo;
        }
        const d = await api.jobs.list(params);
        if (alive) setData(d);
      } catch (err) {
        if (alive) {
          toast.error(err.message);
          setData({ total: 0, page: 1, pageCount: 1, from: 0, to: 0, items: [] });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [page, pageSize, sortKey, status, query, source, searchId, runId, location, postedPeriod, postedFrom, postedTo, fetchedPeriod, fetchedFrom, fetchedTo]);

  const hasFilters =
    query.trim() !== '' ||
    source !== 'all' ||
    searchId !== 'all' ||
    runId !== 'all' ||
    location.trim() !== '' ||
    postedPeriod !== 'any' ||
    fetchedPeriod !== 'any' ||
    status !== 'active';

  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setSource('all');
    setSearchId('all');
    setRunId('all');
    setLocation('');
    setPostedPeriod('any');
    setFetchedPeriod('any');
    setStatus('active');
    setPage(1);
  };

  const searchOptions = useMemo(
    () => (routines ?? []).map((r) => ({ id: r.id, label: r.name })),
    [routines]
  );

  const routineDdOptions = useMemo(
    () => [{ value: 'all', label: 'All routines' }, ...searchOptions.map((s) => ({ value: s.id, label: s.label }))],
    [searchOptions]
  );

  const runDdOptions = useMemo(
    () => [
      { value: 'all', label: 'All runs' },
      ...runsList.map((r) => ({
        value: r.id,
        label: `${r.module === 'linkedin' ? 'LinkedIn' : 'Upwork'} run · ${relTime(r.started_at)} · ${r.total_found} fetched`,
      })),
    ],
    [runsList]
  );

  const postedDdOptions = useMemo(() => PERIODS.map(([v, l]) => ({ value: v, label: `Posted: ${l}` })), []);
  const fetchedDdOptions = useMemo(() => PERIODS.map(([v, l]) => ({ value: v, label: `Fetched: ${l}` })), []);

  const toggleSort = (colKey) => {
    const col = COLUMNS.find((c) => c.key === colKey);
    if (!col || !col.sort) return;
    setSort((prev) => {
      if (prev.key === col.sort) return { key: col.sort, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
      return { key: col.sort, dir: col.sort === 'title' || col.sort === 'company' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const arrowFor = (colKey) => {
    const col = COLUMNS.find((c) => c.key === colKey);
    if (!col || !col.sort || sort.key !== col.sort) return null;
    return <span className="jt-arrow">{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const empty = !loading && data && data.total === 0;

  return (
    <div>
      <div className="section-head">
        <h2>Jobs</h2>
        <div className="section-actions">
          <span className="muted">{data ? `${data.total} jobs` : ''}</span>
        </div>
      </div>

      <div className="list-toolbar">
        <div className="lt-search">
          <Icon name="search" size={15} />
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search title, company, description…"
            aria-label="Search jobs"
          />
          {searchInput ? (
            <button
              type="button"
              className="lt-clear"
              onClick={() => {
                setSearchInput('');
                setQuery('');
                setPage(1);
              }}
              aria-label="Clear search"
            >
              <Icon name="x" size={12} />
            </button>
          ) : null}
        </div>
        <div className="lt-side">
          <FilterDropdown
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            ariaLabel="Filter by platform"
            options={PLATFORM_OPTIONS}
            value={source}
            onChange={(v) => {
              setSource(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            ariaLabel="Filter by date posted"
            options={postedDdOptions}
            value={postedPeriod}
            onChange={(v) => {
              setPostedPeriod(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            ariaLabel="Filter by date fetched"
            options={fetchedDdOptions}
            value={fetchedPeriod}
            onChange={(v) => {
              setFetchedPeriod(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            ariaLabel="Filter by routine"
            options={routineDdOptions}
            value={searchId}
            onChange={(v) => {
              setSearchId(v);
              setPage(1);
            }}
          />
          <FilterDropdown
            ariaLabel="Filter by run"
            options={runDdOptions}
            value={runId}
            onChange={(v) => {
              setRunId(v);
              setPage(1);
            }}
          />
          <div className="lt-search jf-loc">
            <Icon name="globe" size={14} />
            <input
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
              placeholder="Location contains…"
              aria-label="Filter by location"
            />
          </div>
        </div>
      </div>

      {(postedPeriod === 'custom' || fetchedPeriod === 'custom') && (
        <div className="jobs-custom-range">
          {postedPeriod === 'custom' && (
            <>
              <span className="jf-label">Posted between</span>
              <input
                type="date"
                className="jf-select"
                value={postedFrom}
                onChange={(e) => {
                  setPostedFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span className="jf-label">and</span>
              <input
                type="date"
                className="jf-select"
                value={postedTo}
                onChange={(e) => {
                  setPostedTo(e.target.value);
                  setPage(1);
                }}
              />
            </>
          )}
          {fetchedPeriod === 'custom' && (
            <>
              <span className="jf-label">Fetched between</span>
              <input
                type="date"
                className="jf-select"
                value={fetchedFrom}
                onChange={(e) => {
                  setFetchedFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span className="jf-label">and</span>
              <input
                type="date"
                className="jf-select"
                value={fetchedTo}
                onChange={(e) => {
                  setFetchedTo(e.target.value);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={10} />
      ) : empty ? (
        hasFilters ? (
          <EmptyFilter message="No jobs match the current filters" onClear={clearFilters} />
        ) : (
          <EmptyState
            icon="list"
            title="No jobs yet"
            hint="Run a search — every job it fetches lands here, across all runs and platforms."
          />
        )
      ) : (
        <>
          <div className="datalist jt-wrap">
            <table className="jt-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={c.sort ? 'jt-sortable' : undefined}
                      onClick={c.sort ? () => toggleSort(c.key) : undefined}
                    >
                      {c.label}
                      {arrowFor(c.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((j) => (
                  <tr key={j.id} className="jt-row" onClick={() => onOpenJob(j.id)}>
                    <td className="jt-title-cell">
                      <button
                        type="button"
                        className="dl-title jt-title-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenJob(j.id);
                        }}
                        title="View job details"
                      >
                        {j.title}
                      </button>
                      {j.bookmarked ? <span className="jt-flag" title="Bookmarked">★</span> : null}
                      {j.is_new ? <span className="tag tag-new">new</span> : null}
                    </td>
                    <td className="jt-muted">{j.company || '—'}</td>
                    <td>
                      <span className={`badge badge-${j.source}`}>
                        {j.source === 'linkedin' ? 'LinkedIn' : 'Upwork'}
                      </span>
                    </td>
                    <td>
                      {j.location ? <span className="pill pill-muted jt-loc">{j.location}</span> : <span className="jt-muted">—</span>}
                    </td>
                    <td className="jt-muted jt-date">{fmtDate(j.posted_date)}</td>
                    <td className="jt-muted jt-date">
                      {fmtDateTime(j.fetched_at)}
                      <span className="jt-rel">{relTime(j.fetched_at)}</span>
                    </td>
                    <td className="jt-src">
                      <button
                        type="button"
                        className="jt-run-link"
                        title="Open this run's job listing"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRun(j.run_id);
                        }}
                      >
                        {j.search_keywords.length ? j.search_keywords.join(', ') : 'Run listing'}
                      </button>
                      <span className="jt-rel">
                        run · {relTime(j.run_started_at ?? j.fetched_at)}
                      </span>
                    </td>
                    <td className="jt-actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="View job details"
                        aria-label="View job details"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenJob(j.id);
                        }}
                      >
                        <Icon name="chevron" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dl-footer">
            <span className="dl-range">
              Showing {data.from}–{data.to} of {data.total} jobs
            </span>
            <div className="jt-page-size">
              <label className="lt-sort">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={12} />
              </label>
              <div className="dl-pager">
                <button
                  type="button"
                  className="dl-page-btn"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="Previous page"
                >
                  <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                    <Icon name="chevron" size={13} />
                  </span>
                </button>
                <span className="dl-range">
                  Page {data.page} of {data.pageCount}
                </span>
                <button
                  type="button"
                  className="dl-page-btn"
                  disabled={page === data.pageCount}
                  onClick={() => setPage(page + 1)}
                  aria-label="Next page"
                >
                  <Icon name="chevron" size={13} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
