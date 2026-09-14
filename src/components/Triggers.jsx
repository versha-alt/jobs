import React, { useEffect, useState } from 'react';
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
} from './ui.jsx';

const DAY_NAMES = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

function formatDays(days) {
  return (days ?? []).map((d) => DAY_NAMES[d]).join(', ') || 'no days';
}

function scheduleSummary(trigger) {
  const t = trigger.time;
  if (trigger.frequency === 'hourly') return `Every hour at :${t.split(':')[1]}`;
  if (trigger.frequency === 'daily') return `Every day at ${t}`;
  return `${formatDays(trigger.days_of_week)} at ${t}`;
}

function TriggerForm({ mode = 'create', initial, searches, onDone, onCancel }) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [module, setModule] = useState(initial?.module ?? 'linkedin');
  const [searchId, setSearchId] = useState(initial?.linked_search_id ?? '');
  const [frequency, setFrequency] = useState(initial?.frequency ?? 'daily');
  const [time, setTime] = useState(initial?.time ?? '09:00');
  const [minute, setMinute] = useState((initial?.time ?? '09:00').split(':')[1] ?? '00');
  const [days, setDays] = useState(initial?.days_of_week ?? [1]);
  const [moduleInputs, setModuleInputs] = useState(initial?.module_inputs ?? {});
  const [moduleDefs, setModuleDefs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [invalid, shake] = useShake();

  useEffect(() => {
    let alive = true;
    api
      .modules
      .list()
      .then((defs) => {
        if (alive) setModuleDefs(defs);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const def = moduleDefs.find((m) => m.id === module);
  const hasModuleFields = Boolean(def?.inputFields?.length);

  const setInput = (key, value) =>
    setModuleInputs((prev) => {
      const next = { ...prev };
      if (value === '' || value == null || (Array.isArray(value) && value.length === 0)) delete next[key];
      else next[key] = value;
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim()) {
      shake();
      return;
    }
    setSaving(true);
    try {
      const body = {
        label,
        module,
        linked_search_id: searchId,
        frequency,
        time: frequency === 'hourly' ? `00:${minute}` : time,
        days_of_week: days,
        module_inputs: moduleInputs,
      };
      if (mode === 'edit') await api.triggers.update(initial.id, body);
      else await api.triggers.create(body);
      toast.success(
        mode === 'edit' ? 'Trigger updated' : mode === 'duplicate' ? 'Trigger duplicated' : 'Trigger scheduled'
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
          Label <em className="req">required</em>
        </span>
        <div className={invalid ? 'shake' : undefined}>
          <input
            className={`text-input${invalid ? ' invalid' : ''}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. LinkedIn daily sweep"
          />
        </div>
      </label>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Module</span>
          <select
            className="text-input"
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setModuleInputs({});
            }}
          >
            <option value="linkedin">LinkedIn</option>
            <option value="upwork">Upwork</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Linked search</span>
          <select
            className="text-input"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          >
            <option value="">Select a search…</option>
            {searches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.keywords.join(', ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AnimatePresence initial={false}>
        {hasModuleFields && (
          <motion.div
            key={`inputs-${module}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="module-inputs">
              <div className="module-inputs-head">
                <span className="field-label" style={{ marginBottom: 2 }}>
                  {def.label} module settings
                </span>
                <code className="actor-hint">actor: {def.actorIdExample}</code>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                Module-specific tuning. Keywords, locations and the time filter always come from
                the linked search.
              </p>
              {def.inputFields.map((field) => {
                const value = moduleInputs[field.key] ?? '';
                return (
                  <div className="field" key={field.key}>
                    <span className="field-label">
                      {field.label}
                      {field.required && <em className="req">required</em>}
                    </span>
                    {field.type === 'select' ? (
                      <select
                        className="text-input"
                        value={value}
                        onChange={(e) => setInput(field.key, e.target.value)}
                      >
                        <option value="">
                          {field.default != null ? `Default: ${field.default}` : 'Auto'}
                        </option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'list' ? (
                      <ChipInput
                        values={Array.isArray(value) ? value : []}
                        onChange={(v) => setInput(field.key, v)}
                        placeholder={field.hint || field.label}
                      />
                    ) : (
                      <input
                        className="text-input"
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => setInput(field.key, e.target.value)}
                        placeholder={
                          field.default != null
                            ? `Default: ${field.default}`
                            : field.hint || ''
                        }
                      />
                    )}
                    {field.hint && field.type !== 'list' && (
                      <span className="hint" style={{ marginTop: 4, display: 'block' }}>
                        {field.hint}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <label className="field">
        <span className="field-label">Schedule frequency</span>
        <select
          className="text-input"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      <AnimatePresence initial={false}>
        {frequency !== 'hourly' ? (
          <motion.label
            key="time"
            className="field"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: 'hidden', display: 'block' }}
          >
            <span className="field-label">Time of day</span>
            <input
              type="time"
              className="text-input"
              value={time}
              onChange={(e) => setTime(e.target.value || '09:00')}
            />
          </motion.label>
        ) : (
          <motion.label
            key="minute"
            className="field"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: 'hidden', display: 'block' }}
          >
            <span className="field-label">Minute past the hour</span>
            <select
              className="text-input"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
            >
              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                <option key={m} value={m}>
                  :{m}
                </option>
              ))}
            </select>
          </motion.label>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {frequency === 'weekly' && (
          <motion.div
            key="days"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="field">
              <span className="field-label">Days of week</span>
              <div className="day-row">
                {Object.entries(DAY_NAMES).map(([n, s]) => {
                  const on = days.includes(Number(n));
                  return (
                    <motion.button
                      key={n}
                      type="button"
                      layout
                      className={`day-btn${on ? ' on' : ''}`}
                      whileTap={{ scale: 0.92 }}
                      onClick={() =>
                        setDays(on ? days.filter((x) => x !== Number(n)) : [...days, Number(n)].sort())
                      }
                    >
                      {s}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : mode === 'duplicate' ? 'Save copy' : 'Save trigger'}
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

function TriggerCard({ trigger, onRunStarted, onEdit, onDuplicate, onChanged }) {
  const [confirming, setConfirming] = useState(false);

  const runNow = async () => {
    try {
      const { runId } = await api.triggers.runNow(trigger.id);
      toast.success(`Run started for “${trigger.label}” — opening Run history`);
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
    <motion.div layout className="card">
      <div className="card-head">
        <button type="button" className="card-title card-title-btn" onClick={onEdit}>
          <StatusDot status="idle" />
          <span>{trigger.label}</span>
          <span className={`badge badge-${trigger.module}`}>
            {trigger.module === 'linkedin' ? 'LinkedIn' : 'Upwork'}
          </span>
        </button>
        <div className="card-actions">
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
      <div className="meta-row">
        <span className="meta">
          <Icon name="clock" size={12} /> {summary}
        </span>
        {trigger.search ? (
          <span className="meta">{trigger.search.keywords.join(', ')}</span>
        ) : (
          <span className="meta err-text">linked search missing</span>
        )}
      </div>
      <div className="next-run">
        <span className="muted">Next:</span> {new Date(trigger.next_run_at).toLocaleString()}{' '}
        <Countdown iso={trigger.next_run_at} />
      </div>
    </motion.div>
  );
}

export default function Triggers({ searches, triggers, loading, reload, goToListSearches, onRunStarted }) {
  const [modal, setModal] = useState(null);
  const [moduleFilter, setModuleFilter] = useState('all');
  const hasSearches = searches.length > 0;

  const list = (triggers ?? [])
    .filter((t) => moduleFilter === 'all' || t.module === moduleFilter)
    .sort((a, b) => (a.next_run_at ?? '').localeCompare(b.next_run_at ?? ''));

  const openCreate = () => {
    if (!hasSearches) {
      goToListSearches();
      return;
    }
    setModal({ mode: 'create' });
  };

  const closeModal = () => setModal(null);
  const modalTitle =
    modal?.mode === 'create' ? 'New trigger' : modal?.mode === 'duplicate' ? 'Duplicate trigger' : 'Edit trigger';
  const modalTrigger = modal?.trigger;
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
              ? moduleFilter !== 'all'
                ? `${list.length} of ${triggers.length}`
                : `${triggers.length} trigger(s)`
              : ''}
          </span>
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={loading}
            title={hasSearches ? 'Create a scheduled trigger' : 'Create a saved search first'}>
            <Icon name="plus" size={14} />
            New trigger
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={2} />
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
          hint="Add a trigger so your searches run on a schedule and deliver CSVs to Telegram."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
              New trigger
            </button>
          }
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
          </div>
          {list.length === 0 ? (
            <div className="empty-filter">No triggers for this module</div>
          ) : (
            <div className="stack">
              <AnimatePresence initial={false}>
                {list.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <TriggerCard
                      trigger={t}
                      onRunStarted={onRunStarted}
                      onEdit={() => setModal({ mode: 'edit', trigger: t })}
                      onDuplicate={() => setModal({ mode: 'duplicate', trigger: t })}
                      onChanged={reload}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(modal)}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={closeModal}
        wide
      >
        {modal && (
          <TriggerForm
            key={`${modal.mode}_${modal.trigger?.id ?? 'new'}`}
            mode={modal.mode}
            initial={
              modal.mode === 'create'
                ? undefined
                : modal.mode === 'duplicate'
                  ? duplicateValues(modal.trigger)
                  : modal.trigger
            }
            searches={searches}
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
