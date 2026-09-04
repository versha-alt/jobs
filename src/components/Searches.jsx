import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import {
  ChipInput,
  Collapsible,
  EASE,
  EmptyState,
  Icon,
  Segmented,
  SkeletonList,
  useShake,
} from './ui.jsx';

export const TIME_LABELS = { day: 'Last 24 hours', week: 'Last week', month: 'Last month' };

export function SearchForm({ initial, countries, onDone, onCancel }) {
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
      if (initial) await api.searches.update(initial.id, body);
      else await api.searches.create(body);
      toast.success(initial ? 'Search updated' : 'Search saved');
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
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save search'}
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

function SearchCard({ search, countries, expanded, onToggle, onChanged }) {
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
    <motion.div layout className="card">
      <div className="card-head">
        <button type="button" className="card-title card-title-btn" onClick={onToggle}>
          <Icon name="search" />
          <span>{search.keywords.join(', ')}</span>
        </button>
        <div className="card-actions">
          <button
            type="button"
            className={`btn btn-ghost btn-icon${expanded ? ' active' : ''}`}
            onClick={onToggle}
            aria-label="Edit search"
          >
            <motion.span animate={{ rotate: expanded ? 90 : 0 }}>
              <Icon name="chevron" />
            </motion.span>
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
      <div className="meta-row">
        <span className="meta">{TIME_LABELS[search.time_filter] ?? search.time_filter}</span>
        {search.locations.length > 0 && <span className="meta">{search.locations.join(', ')}</span>}
        {search.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <Collapsible open={expanded}>
        <div className="card-body">
          <SearchForm
            initial={search}
            countries={countries}
            onDone={() => {
              onToggle();
              onChanged();
            }}
            onCancel={onToggle}
          />
        </div>
      </Collapsible>
    </motion.div>
  );
}

export default function Searches({ countries, searches, loading, reload }) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const q = query.trim().toLowerCase();
  const filtered = (searches ?? []).filter((s) => {
    if (!q) return true;
    return [...s.keywords, ...s.locations, ...s.tags, TIME_LABELS[s.time_filter] ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <div>
      <div className="section-head">
        <h2>Saved searches</h2>
        <div className="section-actions">
          <span className="muted">
            {searches ? (q ? `${filtered.length} of ${searches.length}` : `${searches.length}`) : ''}
          </span>
          <button
            type="button"
            className={`btn ${creating ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => setCreating(!creating)}
          >
            <Icon name={creating ? 'x' : 'plus'} size={14} />
            {creating ? 'Close' : 'New search'}
          </button>
        </div>
      </div>

      <Collapsible open={creating}>
        <div className="card card-body form-card">
          <SearchForm
            countries={countries}
            onDone={() => {
              setCreating(false);
              reload();
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      </Collapsible>

      {loading ? (
        <SkeletonList rows={2} />
      ) : !searches || searches.length === 0 ? (
        <EmptyState
          icon="search"
          title="No saved searches yet"
          hint="Create your first search — keywords, countries, recency window and tags."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New search
            </button>
          }
        />
      ) : (
        <>
          <div className="toolbar">
            <div className="filter-input">
              <Icon name="search" size={14} />
              <input
                className="text-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by keyword, location, tag…"
              />
              {query && (
                <button
                  type="button"
                  className="filter-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear filter"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="empty-filter">No searches match “{query}”</div>
          ) : (
            <div className="stack">
              <AnimatePresence initial={false}>
                {filtered.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <SearchCard
                      search={s}
                      countries={countries}
                      expanded={expandedId === s.id}
                      onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      onChanged={reload}
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
