p = 'src/components/Triggers.jsx'
s = open(p, encoding='utf8').read()

s = s.replace(
    """import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import {
  ChipInput,
  Countdown,
  EASE,
  EmptyState,
  Icon,
  Modal,
  Segmented,
  SkeletonList,
  Spinner,
  StatusDot,
  useShake,
} from './ui.jsx';""",
    """import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import {
  ChipInput,
  Countdown,
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
  StatusDot,
  usePagedList,
  useShake,
} from './ui.jsx';"""
)

start = s.index('function TriggerCard(')
end = s.index('export default function Triggers(')
new_card = '''function TriggerRow({ trigger, onRunStarted, onEdit, onDuplicate, onChanged }) {
  const [confirming, setConfirming] = useState(false);

  const runNow = async () => {
    try {
      const { runId } = await api.triggers.runNow(trigger.id);
      toast.success(`Run started for "${trigger.label}" - opening Run history`);
      onRunStarted(runId);
    } catch (err) {
      toast.error(err.message);
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
      toast.success('Trigger deleted');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const summary = scheduleSummary(trigger);

  return (
    <div className="dl-row dl-row-trigger">
      <StatusDot status="idle" />
      <div className="dl-main">
        <button type="button" className="dl-title" onClick={onEdit} title="Edit trigger">
          {trigger.label}
        </button>
        <span className={`badge badge-${trigger.module}`}>
          {trigger.module === 'linkedin' ? 'LinkedIn' : 'Upwork'}
        </span>
      </div>
      <span className="dl-meta dl-cadence" title={summary}>
        <Icon name="clock" size={13} />
        {summary}
      </span>
      <span
        className="dl-meta dl-searchcell dl-trunc"
        title={trigger.search ? trigger.search.keywords.join(', ') : undefined}
      >
        {trigger.search ? (
          trigger.search.keywords.join(', ')
        ) : (
          <span className="err-text">linked search missing</span>
        )}
      </span>
      <div className="dl-next">
        <span className="dl-next-rel">
          <Countdown iso={trigger.next_run_at} />
        </span>
        <span className="dl-next-abs">
          {trigger.next_run_at ? new Date(trigger.next_run_at).toLocaleString() : '-'}
        </span>
      </div>
      <div className="dl-actions">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={runNow}
          title="Run now"
          aria-label="Run now"
        >
          <Icon name="play" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onEdit}
          title="Edit trigger"
          aria-label="Edit trigger"
        >
          <Icon name="edit" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onDuplicate}
          title="Duplicate trigger"
          aria-label="Duplicate trigger"
        >
          <Icon name="copy" />
        </button>
        <button
          type="button"
          className={`btn btn-icon ${confirming ? 'btn-danger' : 'btn-ghost'}`}
          onClick={remove}
          aria-label="Delete trigger"
        >
          {confirming ? 'Sure?' : <Icon name="trash" />}
        </button>
      </div>
    </div>
  );
}

'''
s = s[:start] + new_card + s[end:]

start = s.index('export default function Triggers(')
end = s.index('      <Modal')
new_component = '''export default function Triggers({ searches, triggers, loading, reload, goToListSearches, onRunStarted }) {
  const [modal, setModal] = useState(null);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('next');
  const [density, setDensityState] = useState(() => {
    try { return localStorage.getItem('jp_density') || 'cozy'; } catch { return 'cozy'; }
  });
  const setDensity = (d) => {
    setDensityState(d);
    try { localStorage.setItem('jp_density', d); } catch { /* private mode */ }
  };

  const hasSearches = searches.length > 0;
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = (triggers ?? []).filter((t) => {
      if (moduleFilter !== 'all' && t.module !== moduleFilter) return false;
      if (!q) return true;
      return [t.label, t.search ? t.search.keywords.join(', ') : '', scheduleSummary(t)]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    const name = (t) => t.label.toLowerCase();
    if (sort === 'next') {
      list = [...list].sort((a, b) => (a.next_run_at ?? '9999').localeCompare(b.next_run_at ?? '9999'));
    }
    if (sort === 'updated') list = [...list].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    if (sort === 'name') list = [...list].sort((a, b) => name(a).localeCompare(name(b)));
    return list;
  }, [triggers, moduleFilter, q, sort]);

  const listview = usePagedList(filtered, 12);
  const hasFilters = Boolean(q) || moduleFilter !== 'all';

  const openCreate = () => {
    if (!hasSearches) {
      goToListSearches();
      return;
    }
    setModal({ mode: 'create' });
  };

  const closeModal = () => setModal(null);
  const modalTitle =
    modal && modal.mode === 'create' ? 'New trigger' : modal && modal.mode === 'duplicate' ? 'Duplicate trigger' : 'Edit trigger';
  const modalTrigger = modal ? modal.trigger : undefined;
  const modalSubtitle = modalTrigger ? modalTrigger.label : 'Runs a module against a saved search on a schedule';

  const duplicateValues = (t) => ({
    ...t,
    label: `${t.label} (copy)`,
  });

  return (
    <div>
      <div className="section-head">
        <h2>Scheduling</h2>
        <div className="section-actions">
          <span className="muted">
            {triggers
              ? hasFilters
                ? `${filtered.length} of ${triggers.length}`
                : `${triggers.length} trigger(s)`
              : ''}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
            disabled={loading}
            title={hasSearches ? 'Create a scheduled trigger' : 'Create a saved search first'}
          >
            <Icon name="plus" size={14} />
            New trigger
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={9} />
      ) : searches.length === 0 ? (
        <EmptyState
          icon="zap"
          title="Create a saved search first"
          hint="Triggers run a module (LinkedIn or Upwork) against a saved search on a schedule."
          action={
            <button type="button" className="btn btn-primary" onClick={goToListSearches}>
              Go to searches
            </button>
          }
        />
      ) : !triggers || triggers.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No triggers yet"
          hint="Add a trigger so your searches run on a schedule and deliver fresh matches to Telegram."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
              New trigger
            </button>
          }
        />
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            placeholder="Search by trigger, search, schedule..."
            sort={sort}
            onSort={setSort}
            sortOptions={[
              { value: 'next', label: 'Next run time' },
              { value: 'updated', label: 'Recently updated' },
              { value: 'name', label: 'Name A-Z' },
            ]}
            density={density}
            onDensity={setDensity}
          >
            <Segmented
              value={moduleFilter}
              onChange={setModuleFilter}
              options={[
                { value: 'all', label: 'All modules' },
                { value: 'linkedin', label: 'LinkedIn' },
                { value: 'upwork', label: 'Upwork' },
              ]}
            />
          </ListToolbar>

          {filtered.length === 0 ? (
            <EmptyFilter
              message={query ? `No triggers match "${query}"` : 'No triggers for this module'}
              onClear={
                hasFilters
                  ? () => {
                      setQuery('');
                      setModuleFilter('all');
                    }
                  : undefined
              }
            />
          ) : (
            <div className={`datalist${density === 'compact' ? ' dl-compact' : ''}`}>
              {listview.slice.map((t) => (
                <TriggerRow
                  key={t.id}
                  trigger={t}
                  onRunStarted={onRunStarted}
                  onEdit={() => setModal({ mode: 'edit', trigger: t })}
                  onDuplicate={() => setModal({ mode: 'duplicate', trigger: t })}
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
              unit="triggers"
            />
          )}
        </>
      )}

'''
s = s[:start] + new_component + s[end:]
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('Triggers reworked ok')
