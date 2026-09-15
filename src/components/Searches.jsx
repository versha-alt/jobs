import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import {
  ChipInput,
  EASE,
  EmptyFilter,
  EmptyState,
  Icon,
  ListToolbar,
  Modal,
  Pagination,
  Segmented,
  SkeletonRows,
  Spinner,
  usePagedList,
  useShake,
} from './ui.jsx';

export const TIME_LABELS = { day: 'Last 24 hours', week: 'Last week', month: 'Last month' };

export function SearchForm({ mode = 'create', initial, countries, onDone, onCancel }) {
  const [keywords, setKeywords] = useState(initial?.keywords ?? []);
  const [locations, setLocations] = useState(initial?.locations ?? []);
  const [timeFilter, setTimeFilter] = useState(initial?.time_filter ?? 'week');
  const [tags, setTags] = useState(initial?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [invalid, shake] = useShake();

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e) => {
    e.preventDefault();
    if (!keywords.length) {
      shake();
      return;
    }
    setSaving(true);
    try {
      const body = { keywords, locations, time_filter: timeFilter, tags };
      if (mode === 'edit') await api.searches.update(initial.id, body);
      else await api.searches.create(body);
      toast.success(
        mode === 'edit' ? 'Search updated' : mode === 'duplicate' ? 'Search duplicated' : 'Search saved'
      );
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">
          Keywords <em className="req">required</em>
        </span>
        <div className={invalid ? 'shake' : undefined}>
          <ChipInput
            values={keywords}
            onChange={setKeywords}
            placeholder="Type a keyword and press Enter"
            invalid={invalid}
          />
        </div>
        {invalid && <span className="field-err">Add at least one keyword</span>}
      </label>

      <label className="field">
        <span className="field-label">
          Locations <em className="opt">optional</em>
        </span>
        {countries.length === 0 ? (
          <span className="muted">No countries yet — add some in Settings</span>
        ) : (
          <div className="multi-select">
            <AnimatePresence initial={false}>
              {countries.map((c) => (
                <motion.button
                  key={c.id}
                  layout
                  type="button"
                  className={`chip selectable${locations.includes(c.name) ? ' on' : ''}`}
                  onClick={() => toggle(locations, setLocations, c.name)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15, ease: EASE }}
                >
                  {c.name}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </label>

      <label className="field">
        <span className="field-label">
          Posted within <em className="opt">defaults to Last week</em>
        </span>
        <Segmented
          value={timeFilter}
          onChange={setTimeFilter}
          options={Object.entries(TIME_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Tags <em className="opt">optional</em>
        </span>
        <ChipInput values={tags} onChange={setTags} placeholder="e.g. remote, contract" />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : mode === 'duplicate' ? 'Save copy' : 'Save search'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function SearchRow({ search, onEdit, onDuplicate, onChanged }) {
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    try {
      await api.searches.remove(search.id);
      toast.success('Search deleted');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="dl-row dl-row-search">
      <span className="dl-icon-tile">
        <Icon name="search" size={15} />
      </span>
      <div className="dl-main">
        <button type="button" className="dl-title" onClick={onEdit} title="Edit search">
          {search.keywords.join(', ')}
        </button>
        {search.tags.length > 0 && (
          <span className="dl-chips">
            {search.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </span>
        )}
      </div>
      <span
        className="dl-meta dl-loc"
        title={search.locations.length ? search.locations.join(', ') : undefined}
      >
        <Icon name="globe" size={13} />
        {search.locations.length ? search.locations.join(', ') : 'All locations'}
      </span>
      <span className="pill pill-muted dl-recency">
        {TIME_LABELS[search.time_filter] ?? search.time_filter}
      </span>
      <div className="dl-actions">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onEdit}
          title="Edit search"
          aria-label="Edit search"
        >
          <Icon name="edit" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onDuplicate}
          title="Duplicate search"
          aria-label="Duplicate search"
        >
          <Icon name="copy" />
        </button>
        <button
          type="button"
          className={`btn btn-icon ${confirming ? 'btn-danger' : 'btn-ghost'}`}
          onClick={remove}
          aria-label="Delete search"
        >
          {confirming ? 'Sure?' : <Icon name="trash" />}
        </button>
      </div>
    </div>
  );
}

export default function Searches({ countries, searches, loading, reload }) {
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [recency, setRecency] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [sort, setSort] = useState('updated');
  const [density, setDensityState] = useState(() => {
    try { return localStorage.getItem('jp_density') || 'cozy'; } catch { return 'cozy'; }
  });
  const setDensity = (d) => {
    setDensityState(d);
    try { localStorage.setItem('jp_density', d); } catch { /* private mode */ }
  };

  const allTags = useMemo(
    () => [...new Set((searches ?? []).flatMap((s) => s.tags))].sort(),
    [searches]
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = (searches ?? []).filter((s) => {
      if (recency !== 'all' && s.time_filter !== recency) return false;
      if (tagFilter !== 'all' && !s.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return [...s.keywords, ...s.locations, ...s.tags, TIME_LABELS[s.time_filter] ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    const name = (s) => s.keywords.join(', ').toLowerCase();
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    if (sort === 'name-asc') list = [...list].sort((a, b) => name(a).localeCompare(name(b)));
    if (sort === 'name-desc') list = [...list].sort((a, b) => name(b).localeCompare(name(a)));
    return list;
  }, [searches, q, recency, tagFilter, sort]);

  const listview = usePagedList(filtered, 12);
  const hasFilters = Boolean(q) || recency !== 'all' || tagFilter !== 'all';
  const clearFilters = () => {
    setQuery('');
    setRecency('all');
    setTagFilter('all');
  };

  const closeModal = () => setModal(null);
  const modalTitle =
    modal?.mode === 'create' ? 'New search' : modal?.mode === 'duplicate' ? 'Duplicate search' : 'Edit search';
  const modalSubtitle =
    modal && modal.mode !== 'create' ? modal.search.keywords.join(', ') : 'Keywords, countries, recency window and tags';

  return (
    <div>
      <div className="section-head">
        <h2>Saved searches</h2>
        <div className="section-actions">
          <span className="muted">
            {searches ? (hasFilters ? `${filtered.length} of ${searches.length}` : `${searches.length}`) : ''}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
          >
            <Icon name="plus" size={14} />
            New search
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={9} />
      ) : !searches || searches.length === 0 ? (
        <EmptyState
          icon="search"
          title="No saved searches yet"
          hint="Create your first search — keywords, countries, recency window and tags."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
              New search
            </button>
          }
        />
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            placeholder="Search by keyword, location, tag…"
            sort={sort}
            onSort={setSort}
            sortOptions={[
              { value: 'updated', label: 'Recently updated' },
              { value: 'name-asc', label: 'Name A–Z' },
              { value: 'name-desc', label: 'Name Z–A' },
            ]}
            density={density}
            onDensity={setDensity}
          >
            <div className="lt-chiprow" role="group" aria-label="Filter by recency">
              {[['all', 'Any window'], ['day', 'Last 24 hours'], ['week', 'Last week'], ['month', 'Last month']].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`lt-chip${recency === value ? ' on' : ''}`}
                    onClick={() => setRecency(value)}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            {allTags.length > 0 && (
              <div className="lt-chiprow" role="group" aria-label="Filter by tag">
                <button
                  type="button"
                  className={`lt-chip${tagFilter === 'all' ? ' on' : ''}`}
                  onClick={() => setTagFilter('all')}
                >
                  All tags
                </button>
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`lt-chip${tagFilter === t ? ' on' : ''}`}
                    onClick={() => setTagFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </ListToolbar>

          {filtered.length === 0 ? (
            <EmptyFilter
              message={q ? `No searches match “${query}”` : 'No searches match the active filters'}
              onClear={hasFilters ? clearFilters : undefined}
            />
          ) : (
            <div className={`datalist${density === 'compact' ? ' dl-compact' : ''}`}>
              <div className="dl-head dl-head-search" aria-hidden="true">
                <span />
                <span className="dl-h-label">Search</span>
                <span className="dl-h-label dl-loc">Locations</span>
                <span className="dl-h-label dl-recency dl-h-actions">Window</span>
                <span className="dl-h-label dl-h-actions">Actions</span>
              </div>
              {listview.slice.map((s) => (
                <SearchRow
                  key={s.id}
                  search={s}
                  onEdit={() => setModal({ mode: 'edit', search: s })}
                  onDuplicate={() => setModal({ mode: 'duplicate', search: s })}
                  onChanged={reload}
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
              unit="searches"
            />
          )}
        </>
      )}

      <Modal
        open={Boolean(modal)}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={closeModal}
      >
        {modal && (
          <SearchForm
            key={`${modal.mode}_${modal.search?.id ?? 'new'}`}
            mode={modal.mode}
            initial={modal.mode === 'create' ? undefined : modal.search}
            countries={countries}
            onDone={() => {
              closeModal();
              reload();
            }}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
