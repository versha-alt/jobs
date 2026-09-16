import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.js';
import {
  EmptyFilter,
  EmptyState,
  FilterDropdown,
  Icon,
  ListToolbar,
  Pagination,
  SkeletonRows,
  usePagedList,
} from './ui.jsx';

const MODULE_OPTIONS = [
  { value: 'all', label: 'All modules' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'upwork', label: 'Upwork' },
];

const RECENCY_OPTIONS = [
  { value: 'all', label: 'Any window' },
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
];

function RoutineRow({ routine, onOpen, onEdit, onRun, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const runNow = async (e) => {
    e.stopPropagation();
    setRunning(true);
    try {
      await api.routines.runNow(routine.id);
      toast.success(`Run started for "${routine.name}"`);
      onRun();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  const remove = async (e) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    try {
      await api.routines.remove(routine.id);
      toast.success('Routine deleted');
      onDeleted();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const duplicate = async (e) => {
    e.stopPropagation();
    try {
      const full = await api.routines.get(routine.id);
      await api.routines.create({
        name: `${full.name} (copy)`,
        description: full.description,
        module: full.module,
        keywords: full.keywords,
        locations: full.locations,
        posted_within: full.posted_within,
        tags: full.tags,
        volume_per_run: full.volume_per_run,
        module_inputs: full.module_inputs,
        active: full.active,
        schedules: (full.schedules ?? []).map((s) => ({
          type: s.type,
          time: s.time,
          days: s.days,
          active: s.active,
        })),
      });
      toast.success('Routine duplicated');
      onRun();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="dl-row dl-row-routines" onClick={() => onOpen(routine.id)}>
      <span className="dl-icon-tile">
        <Icon name="search" size={15} />
      </span>
      <div className="dl-main">
        <button
          type="button"
          className="dl-title"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(routine.id);
          }}
          title="Open routine"
        >
          {routine.name}
        </button>
        {routine.tags.length > 0 && (
          <span className="dl-chips">
            {routine.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </span>
        )}
      </div>
      <span className="dl-meta dl-loc" title={routine.keywords.join(', ')}>
        <Icon name="search" size={13} />
        {routine.keywords.join(', ')}
      </span>
      <span className="dl-meta dl-cadence" title={routine.schedule_count ? undefined : 'No schedule'}>
        <Icon name="clock" size={13} />
        {routine.schedule_count
          ? `${routine.schedule_count} schedule${routine.schedule_count === 1 ? '' : 's'}`
          : 'no schedule'}
      </span>
      <div className="dl-next">
        <span className="dl-next-rel">
          {routine.next_run_at
            ? new Date(routine.next_run_at).toLocaleString()
            : routine.active
              ? 'active'
              : 'inactive'}
        </span>
      </div>
      <span className={`pill ${routine.active ? 'pill-ok' : 'pill-warn'} dl-recency`}>
        {routine.active ? 'Active' : 'Inactive'}
      </span>
      <div className="dl-actions">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={runNow}
          disabled={running}
          title="Run now"
          aria-label="Run now"
        >
          <Icon name="play" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(routine.id);
          }}
          title="Edit routine"
          aria-label="Edit routine"
        >
          <Icon name="edit" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={duplicate}
          title="Duplicate routine"
          aria-label="Duplicate routine"
        >
          <Icon name="copy" />
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
  );
}

export default function Routines({ routines, loading, reload, onOpen, onEdit, onNew }) {
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [recency, setRecency] = useState('all');
  const [sort, setSort] = useState('updated');
  const [density, setDensityState] = useState(() => {
    try {
      return localStorage.getItem('jp_density') || 'cozy';
    } catch {
      return 'cozy';
    }
  });
  const setDensity = (d) => {
    setDensityState(d);
    try {
      localStorage.setItem('jp_density', d);
    } catch {
      /* private mode */
    }
  };

  const allTags = useMemo(
    () => [...new Set((routines ?? []).flatMap((r) => r.tags))].sort(),
    [routines]
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = (routines ?? []).filter((r) => {
      if (moduleFilter !== 'all' && r.module !== moduleFilter) return false;
      if (tagFilter !== 'all' && !r.tags.includes(tagFilter)) return false;
      if (recency !== 'all' && r.posted_within !== recency) return false;
      if (!q) return true;
      return [r.name, ...r.keywords, ...r.locations, ...r.tags]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    const name = (r) => r.name.toLowerCase();
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    if (sort === 'name-asc') list = [...list].sort((a, b) => name(a).localeCompare(name(b)));
    if (sort === 'name-desc') list = [...list].sort((a, b) => name(b).localeCompare(name(a)));
    return list;
  }, [routines, q, moduleFilter, tagFilter, recency, sort]);

  const listview = usePagedList(filtered, 12);
  const hasFilters = q !== '' || moduleFilter !== 'all' || tagFilter !== 'all' || recency !== 'all';
  const clearFilters = () => {
    setQuery('');
    setModuleFilter('all');
    setTagFilter('all');
    setRecency('all');
  };

  return (
    <div>
      <div className="section-head">
        <h2>Routines</h2>
        <div className="section-actions">
          <span className="muted">
            {routines ? (hasFilters ? `${filtered.length} of ${routines.length}` : `${routines.length}`) : ''}
          </span>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" size={14} />
            New Routine
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={9} />
      ) : !routines || routines.length === 0 ? (
        <EmptyState
          icon="search"
          title="No routines yet"
          hint="A routine combines what to find with when to run it."
          action={
            <button type="button" className="btn btn-primary" onClick={onNew}>
              New Routine
            </button>
          }
        />
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            placeholder="Search by name, keyword, tag..."
            sort={sort}
            onSort={setSort}
            sortOptions={[
              { value: 'updated', label: 'Recently updated' },
              { value: 'name-asc', label: 'Name A-Z' },
              { value: 'name-desc', label: 'Name Z-A' },
            ]}
            density={density}
            onDensity={setDensity}
          >
            <FilterDropdown
              ariaLabel="Filter by module"
              options={MODULE_OPTIONS}
              value={moduleFilter}
              onChange={setModuleFilter}
            />
            <FilterDropdown
              ariaLabel="Filter by recency"
              options={RECENCY_OPTIONS}
              value={recency}
              onChange={setRecency}
            />
            {allTags.length > 0 && (
              <FilterDropdown
                ariaLabel="Filter by tag"
                options={[{ value: 'all', label: 'All tags' }, ...allTags.map((t) => ({ value: t, label: t }))]}
                value={tagFilter}
                onChange={setTagFilter}
              />
            )}
          </ListToolbar>

          {filtered.length === 0 ? (
            <EmptyFilter
              message={query ? `No routines match "${query}"` : 'No routines match the active filters'}
              onClear={hasFilters ? clearFilters : undefined}
            />
          ) : (
            <div className={`datalist${density === 'compact' ? ' dl-compact' : ''}`}>
              <div className="dl-head dl-head-routines" aria-hidden="true">
                <span />
                <span className="dl-h-label">Routine</span>
                <span className="dl-h-label dl-loc">Keywords</span>
                <span className="dl-h-label dl-cadence">Schedules</span>
                <span className="dl-h-label dl-next dl-h-actions">Next run</span>
                <span className="dl-h-label dl-h-actions">Status</span>
                <span className="dl-h-label dl-h-actions">Actions</span>
              </div>
              {listview.slice.map((r) => (
                <RoutineRow
                  key={r.id}
                  routine={r}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onRun={reload}
                  onDeleted={reload}
                />
              ))}
            </div>
          )}
          {filtered.length > 0 && (
            <Pagination
              page={listview.page}
              pageCount={listview.pageCount}
              setPage={listview.setPage}
              from={listview.from}
              to={listview.to}
              total={listview.total}
              unit="routines"
            />
          )}
        </>
      )}
    </div>
  );
}
