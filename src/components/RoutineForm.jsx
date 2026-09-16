import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { ChipInput, Icon, Segmented, SkeletonList, Spinner, useShake } from './ui.jsx';

const VOLUME_LIMIT_HINT =
  'Limited to 1 keyword and 1 location per routine to keep job volume accurate. Create separate routines for additional searches.';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const DAY_NAMES = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
const PERIODS = [
  ['day', 'Last 24 hours'],
  ['week', 'Last week'],
  ['month', 'Last month'],
];

function ScheduleSubForm({ initial, onAdd, onCancel }) {
  const [type, setType] = useState(initial?.type ?? 'daily');
  const [time, setTime] = useState(initial?.time ?? '09:00');
  const [days, setDays] = useState(initial?.days ?? [1]);

  const valid =
    type !== 'weekly' ||
    (Array.isArray(days) && days.length > 0);

  return (
    <div className="sched-subform">
      <div className="field-grid">
        <label className="field">
          <span className="field-label">Schedule type</span>
          <select className="text-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Specific weekdays</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">{type === 'hourly' ? 'Minute past the hour' : 'Time of day'}</span>
          {type === 'hourly' ? (
            <select
              className="text-input"
              value={time.split(':')[1] ?? '00'}
              onChange={(e) => setTime(`00:${e.target.value}`)}
            >
              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                <option key={m} value={m}>
                  :{m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="time"
              className="text-input"
              value={time}
              onChange={(e) => setTime(e.target.value || '09:00')}
            />
          )}
        </label>
      </div>
      {type === 'weekly' && (
        <div className="field">
          <span className="field-label">Days of week</span>
          <div className="day-row">
            {Object.entries(DAY_NAMES).map(([n, label]) => {
              const on = days.includes(Number(n));
              return (
                <button
                  key={n}
                  type="button"
                  className={`day-btn${on ? ' on' : ''}`}
                  onClick={() =>
                    setDays(on ? days.filter((x) => x !== Number(n)) : [...days, Number(n)].sort())
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() =>
            onAdd({
              type,
              time: type === 'hourly' ? `00:${time.split(':')[1] ?? '00'}` : time,
              days: type === 'weekly' ? days : [],
              active: true,
            })
          }
        >
          Add schedule
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function RoutineForm({ mode, routineId, reload }) {
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const [loading, setLoading] = useState(isEdit);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [locations, setLocations] = useState([]);
  const [legacyWarning, setLegacyWarning] = useState(null);
  const [postedWithin, setPostedWithin] = useState('week');
  const [tags, setTags] = useState([]);
  const [module, setModule] = useState('linkedin');
  const [volume, setVolume] = useState(10);
  const [moduleInputs, setModuleInputs] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [active, setActive] = useState(true);
  const [countries, setCountries] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.countries
      .list()
      .then((rows) => {
        if (alive) setCountries(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [invalidField, setInvalidField] = useState(null);
  const [shaking, triggerShake] = useShake();
  const shake = (field) => {
    setInvalidField(field);
    triggerShake();
  };

  useEffect(() => {
    if (!isEdit) return undefined;
    let alive = true;
    api.routines
      .get(routineId)
      .then((r) => {
        if (!alive) return;
        setName(r.name);
        setDescription(r.description ?? '');
        const kw = r.keywords ?? [];
        const locs = r.locations ?? [];
        if (kw.length > 1 || locs.length > 1) {
          setLegacyWarning({ keywordCount: kw.length, locationCount: locs.length });
        }
        setKeywords(kw.slice(0, 1));
        setLocations(locs.slice(0, 1));
        setPostedWithin(r.posted_within);
        setTags(r.tags);
        setModule(r.module);
        setVolume(r.volume_per_run ?? 10);
        setModuleInputs(r.module_inputs ?? {});
        setSchedules(r.schedules ?? []);
        setActive(r.active);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(err.message);
        navigate('/routines');
      });
    return () => {
      alive = false;
    };
  }, [isEdit, routineId]);

  const addSchedule = (sched) => {
    setSchedules((prev) => [...prev, { ...sched, id: undefined }]);
    setAddingSchedule(false);
  };

  const removeSchedule = (idx) => setSchedules((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      shake('name');
      return 'name';
    }
    if (keywords.length === 0) {
      shake('keywords');
      return 'keywords';
    }
    if (keywords.length > 1 || locations.length > 1) {
      shake(keywords.length > 1 ? 'keywords' : 'locations');
      return 'volume-limit';
    }
    if (schedules.length === 0) {
      shake('schedule');
      return 'schedule';
    }
    setInvalidField(null);
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        module,
        keywords,
        locations,
        posted_within: postedWithin,
        tags,
        volume_per_run: volume,
        module_inputs: moduleInputs,
        active,
        schedules,
      };
      if (isEdit) await api.routines.update(routineId, body);
      else await api.routines.create(body);
      await reload?.();
      toast.success(isEdit ? 'Routine updated' : 'Routine created');
      navigate('/routines');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonList rows={3} />;

  return (
    <form
      className="routine-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e);
      }}
    >
      <button type="button" className="btn btn-ghost sd-back" onClick={() => navigate('/routines')}>
        <Icon name="back" size={14} /> Back to routines
      </button>
      <div className="section-head">
        <h2>{isEdit ? 'Edit routine' : 'New routine'}</h2>
      </div>

      {legacyWarning && (
        <div className="rf-legacy-warning">
          This routine currently has {plural(legacyWarning.keywordCount, 'keyword')} and{' '}
          {plural(legacyWarning.locationCount, 'location')}. Only the first of each is shown — saving will drop the
          rest. Create separate routines first if you want to keep them.
        </div>
      )}

      <div className="rf-columns">
        <div className="card rf-col">
          <span className="rf-col-title">What to find</span>
          <label className="field">
            <span className="field-label">
              Routine name <em className="req">required</em>
            </span>
            <input
              className={`text-input${invalidField === 'name' ? ' invalid' : ''}${shaking && invalidField === 'name' ? ' shake' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PHP daily sweep"
            />
          </label>
          <label className="field">
            <span className="field-label">
              Keyword <em className="req">required</em>
            </span>
            <input
              className={`text-input${invalidField === 'keywords' ? ' invalid' : ''}${shaking && invalidField === 'keywords' ? ' shake' : ''}`}
              value={keywords[0] ?? ''}
              onChange={(e) => setKeywords(e.target.value ? [e.target.value] : [])}
              placeholder="e.g. java developer"
            />
            <span className="hint">{VOLUME_LIMIT_HINT}</span>
          </label>
          <label className="field">
            <span className="field-label">
              Description <em className="opt">optional</em>
            </span>
            <textarea
              className="text-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this routine for?"
            />
          </label>
        </div>

        <div className="card rf-col">
          <span className="rf-col-title">Parameters</span>
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
            <span className="field-label">
              Location <em className="opt">optional</em>
            </span>
            <input
              className={`text-input${invalidField === 'locations' ? ' invalid' : ''}${shaking && invalidField === 'locations' ? ' shake' : ''}`}
              list="rf-location-suggestions"
              value={locations[0] ?? ''}
              onChange={(e) => setLocations(e.target.value ? [e.target.value] : [])}
              placeholder="e.g. Australia"
            />
            <datalist id="rf-location-suggestions">
              {countries.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <span className="hint">{VOLUME_LIMIT_HINT}</span>
          </label>
          <label className="field">
            <span className="field-label">Posted within</span>
            <Segmented
              value={postedWithin}
              onChange={setPostedWithin}
              options={PERIODS.map(([value, label]) => ({ value, label }))}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Tags <em className="opt">optional</em>
            </span>
            <ChipInput values={tags} onChange={setTags} placeholder="e.g. remote, contract" />
          </label>
          <label className="field">
            <span className="field-label">
              Volume per Run <em className="opt">default 10</em>
            </span>
            <input
              className="text-input"
              type="number"
              min={1}
              max={100}
              value={volume}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) setVolume(Math.min(Math.max(n, 1), 100));
              }}
            />
            <span className="hint">Recommended max 50; hard practical ceiling ~100</span>
          </label>
        </div>
      </div>

      <div className="card rf-schedules">
        <span className="rf-col-title">When it runs</span>
        {invalidField === 'schedule' && (
          <span className="field-err">Add at least one schedule before saving</span>
        )}
        {schedules.length > 0 ? (
          <div className="sched-list">
            {schedules.map((s, i) => (
              <div key={i} className="sched-item">
                <span className="sched-label">
                  {s.type === 'hourly'
                    ? `Hourly at :${s.time.split(':')[1]}`
                    : s.type === 'daily'
                      ? `Every day at ${s.time}`
                      : `${(s.days ?? []).map((d) => DAY_NAMES[d]).join(', ') || 'No days'} at ${s.time}`}
                </span>
                <span className="dl-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => {
                      setEditingIndex(i);
                      setAddingSchedule(true);
                    }}
                    title="Edit schedule"
                    aria-label="Edit schedule"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setSchedules(schedules.filter((_, x) => x !== i))}
                    title="Remove schedule"
                    aria-label="Remove schedule"
                  >
                    <Icon name="trash" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="muted">No schedules yet — add at least one.</span>
        )}
        {addingSchedule ? (
          <ScheduleSubForm
            initial={editingIndex != null ? schedules[editingIndex] : undefined}
            onAdd={(s) => {
              if (editingIndex != null) {
                setSchedules((prev) => prev.map((x, i) => (i === editingIndex ? { ...s } : x)));
              } else {
                addSchedule(s);
              }
              setEditingIndex(null);
              setAddingSchedule(false);
            }}
            onCancel={() => {
              setEditingIndex(null);
              setAddingSchedule(false);
            }}
          />
        ) : (
          <button type="button" className="btn btn-ghost rf-add-sched" onClick={() => setAddingSchedule(true)}>
            <Icon name="plus" size={14} /> Add schedule
          </button>
        )}
        <label className="rf-active">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activate immediately
        </label>
      </div>

      <div className="form-actions rf-save">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create routine'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/routines')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
