import React, { useEffect, useRef, useState } from 'react';
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
  play: <path d="M7 5l12 7-12 7V5z" />,
  search: <path d="M11 4a7 7 0 105.2 11.9L21 21M11 4a7 7 0 015.2 11.9" />,
  clock: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v5l3.5 2" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  bell: <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zm4 12a2 2 0 004 0" />,
  globe: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z" />,
  zap: <path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" />,
  alert: <path d="M12 3l10 17H2L12 3zm0 7v5m0 3h.01" />,
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
