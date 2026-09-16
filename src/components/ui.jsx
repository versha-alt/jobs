import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

export const EASE = [0.4, 0, 0.2, 1];

export function Collapsible({ open, children }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ChipInput({ values, onChange, placeholder, invalid }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  const remove = (v) => onChange(values.filter((x) => x !== v));
  return (
    <div className={`chip-input${invalid ? ' invalid' : ''}`}>
      <AnimatePresence initial={false}>
        {values.map((v) => (
          <motion.span
            key={v}
            layout
            className="chip"
            initial={{ opacity: 0, scale: 0.7, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: -4 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            {v}
            <button type="button" className="chip-x" onClick={() => remove(v)} aria-label={`Remove ${v}`}>
              <Icon name="x" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && values.length) {
            remove(values[values.length - 1]);
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`seg-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DayPicker({ value, onChange }) {
  const days = [
    { n: 1, s: 'Mon' },
    { n: 2, s: 'Tue' },
    { n: 3, s: 'Wed' },
    { n: 4, s: 'Thu' },
    { n: 5, s: 'Fri' },
    { n: 6, s: 'Sat' },
    { n: 7, s: 'Sun' },
  ];
  return (
    <div className="day-row">
      {days.map((d) => {
        const on = value.includes(d.n);
        return (
          <motion.button
            key={d.n}
            type="button"
            layout
            className={`day-btn${on ? ' on' : ''}`}
            onClick={() => onChange(on ? value.filter((x) => x !== d.n) : [...value, d.n].sort())}
            whileTap={{ scale: 0.92 }}
          >
            {d.s}
          </motion.button>
        );
      })}
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, r = 6, style }) {
  return <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonList({ rows = 3 }) {
  return (
    <div className="skel-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card skel-card">
          <Skeleton w="38%" h={16} />
          <Skeleton w="70%" h={12} style={{ marginTop: 10 }} />
          <Skeleton w="52%" h={12} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function CountUp({ value }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return undefined;
    const t0 = performance.now();
    const dur = 600;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Countdown({ iso }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return <span className="muted">paused</span>;
  const diff = new Date(iso).getTime() - Date.now();
  let text;
  if (diff <= 0) {
    text = 'due now';
  } else {
    const m = Math.floor(diff / 60000);
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const mm = m % 60;
    text = d ? `in ${d}d ${h}h` : h ? `in ${h}h ${mm}m` : `in ${mm}m`;
  }
  return (
    <span className="countdown" title={new Date(iso).toLocaleString()}>
      {text}
    </span>
  );
}

const ICONS = {
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  edit: <path d="M4 20h4l11-11-4-4L4 16v4zM13 6l4 4" />,
  copy: <path d="M9 9h10v10H9zM5 15H4V4h10" />,
  play: <path d="M7 5l12 7-12 7V5z" />,
  search: <path d="M11 4a7 7 0 105.2 11.9L21 21M11 4a7 7 0 015.2 11.9" />,
  clock: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v5l3.5 2" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  bell: <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zm4 12a2 2 0 004 0" />,
  globe: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z" />,
  zap: <path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" />,
  alert: <path d="M12 3l10 17H2L12 3zm0 7v5m0 3h.01" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  back: <path d="M19 12H5m0 0l6-6m-6 6l6 6" />,
  sort: <path d="M8 5v14M8 19l-3.2-3.2M8 19l3.2-3.2M16 19V5m0 0l-3.2 3.2M16 5l3.2 3.2" />,
  rowsCozy: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  rowsCompact: <path d="M4 5h16M4 9.7h16M4 14.3h16M4 19h16" />,
  eye: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <path d="M4 4l16 16" />
    </>
  ),
  grid: <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
  xCircle: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm-3 6l6 6m0-6l-6 6" />,
  logout: <path d="M15 4h4v16h-4M10 17l-5-5 5-5M5 12h11" />,
};

export function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export function EmptyState({ icon = 'search', title, hint, action }) {
  return (
    <motion.div
      className="empty card"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action && <div className="empty-action">{action}</div>}
    </motion.div>
  );
}

export function ModuleBadge({ module }) {
  return <span className={`badge badge-${module}`}>{module === 'linkedin' ? 'LinkedIn' : 'Upwork'}</span>;
}

export function StatusDot({ status }) {
  return (
    <span className={`dot dot-${status}`}>
      {status === 'running' && <span className="dot-pulse" />}
    </span>
  );
}

export function useShake(timeout = 450) {
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (!shake) return undefined;
    const t = setTimeout(() => setShake(false), timeout);
    return () => clearTimeout(t);
  }, [shake, timeout]);
  return [shake, () => setShake(true)];
}

export function Modal({ open, title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
        >
          <motion.div
            className={`modal-panel${wide ? ' wide' : ''}`}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">{title}</div>
                {subtitle && <div className="modal-subtitle">{subtitle}</div>}
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-scroll">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/* ---------- Data list system (Searches & Scheduling) ---------- */

export function usePagedList(items, pageSize = 12) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safe = Math.min(page, pageCount);
  useEffect(() => {
    if (page !== safe) setPage(safe);
  }, [page, safe]);
  const start = (safe - 1) * pageSize;
  return {
    page: safe,
    pageCount,
    setPage,
    total: items.length,
    start,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    slice: items.slice(start, start + pageSize),
  };
}

export function ListToolbar({
  query,
  onQuery,
  placeholder,
  sort,
  sortOptions,
  onSort,
  density,
  onDensity,
  children,
}) {
  return (
    <div className="list-toolbar">
      <div className="lt-search">
        <Icon name="search" size={15} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
        />
        {query ? (
          <button
            type="button"
            className="lt-clear"
            onClick={() => onQuery('')}
            aria-label="Clear search"
          >
            <Icon name="x" size={12} />
          </button>
        ) : null}
      </div>
      <div className="lt-side">
        {children}
        <label className="lt-sort" title="Sort">
          <Icon name="sort" size={14} />
          <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort by">
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={12} />
        </label>
        {onDensity && (
          <div className="lt-density" role="group" aria-label="Row density">
            <button
              type="button"
              className={density === 'cozy' ? 'on' : ''}
              onClick={() => onDensity('cozy')}
              title="Comfortable rows"
              aria-label="Comfortable density"
            >
              <Icon name="rowsCozy" size={14} />
            </button>
            <button
              type="button"
              className={density === 'compact' ? 'on' : ''}
              onClick={() => onDensity('compact')}
              title="Compact rows"
              aria-label="Compact density"
            >
              <Icon name="rowsCompact" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FilterDropdown({ options, value, onChange, icon, ariaLabel, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];
  const isActive = active ?? (options.length > 0 && value !== options[0].value);

  return (
    <div className="filter-dd" ref={ref}>
      <button
        type="button"
        className={`filter-dd-btn${isActive ? ' on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {icon && <Icon name={icon} size={13} />}
        <span>{current?.label ?? ''}</span>
        <Icon name="chevron" size={11} />
      </button>
      {open && (
        <div className="filter-dd-panel" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`filter-dd-option${o.value === value ? ' on' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function pageList(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, 2, count - 1, count, page - 1, page, page + 1]);
  const arr = [...set].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of arr) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ page, pageCount, setPage, from, to, total, unit = 'items' }) {
  const label =
    pageCount <= 1 ? `${total} ${unit}` : `Showing ${from}–${to} of ${total} ${unit}`;
  return (
    <div className="dl-footer">
      <span className="dl-range">{label}</span>
      {pageCount > 1 && (
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
          {pageList(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`gap${i}`} className="dl-page-gap">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`dl-page-btn${p === page ? ' on' : ''}`}
                onClick={() => setPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            className="dl-page-btn"
            disabled={page === pageCount}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            <Icon name="chevron" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 8 }) {
  return (
    <div className="datalist skel-rows" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="dl-row">
          <span className="skel" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <span className="skel" style={{ width: `${34 + ((i * 9) % 22)}%`, height: 14 }} />
          <span className="skel" style={{ width: '16%', height: 12 }} />
          <span className="skel" style={{ width: 70, height: 20, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyFilter({ message, onClear }) {
  return (
    <div className="datalist empty-filter-card">
      <p className="empty-filter-title">{message}</p>
      <p className="empty-filter-hint">Try a different search term or clear the active filters.</p>
      {onClear && (
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

export function humanizeKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function classifyValue(v) {
  if (v === null || v === undefined || v === '') return { empty: true };
  if (typeof v === 'boolean') return { text: v ? 'Yes' : 'No' };
  if (Array.isArray(v) || typeof v === 'object') {
    const json = JSON.stringify(v, null, 1);
    return json.replace(/\s/g, '').length <= 4 ? { empty: true } : { text: json, long: true };
  }
  const text = String(v);
  return { text, long: text.length > 240 };
}

// every field the API stored for this job, unfiltered
export function RawRecord({ raw }) {
  const [open, setOpen] = useState(false);
  if (!raw || Object.keys(raw).length === 0) return null;
  const entries = Object.entries(raw);
  const filled = entries.filter(([, v]) => !classifyValue(v).empty).length;

  return (
    <div className="card raw-card">
      <button type="button" className="raw-toggle" onClick={() => setOpen(!open)}>
        <motion.span animate={{ rotate: open ? 90 : 0 }} style={{ display: 'inline-flex' }}>
          <Icon name="chevron" size={14} />
        </motion.span>
        All fields returned for this job
        <span className="raw-count">{filled} of {entries.length} recorded</span>
      </button>
      <Collapsible open={open}>
        <div className="raw-grid">
          {entries.map(([key, value]) => {
            const info = classifyValue(value);
            return (
              <div key={key} className={`raw-row${info.empty ? ' raw-empty' : ''}`}>
                <span className="raw-key">{humanizeKey(key)}</span>
                {info.empty ? (
                  <span className="raw-val">—</span>
                ) : (
                  <span className={`raw-val${info.long ? ' raw-long' : ''}`}>{info.text}</span>
                )}
              </div>
            );
          })}
        </div>
      </Collapsible>
    </div>
  );
}
