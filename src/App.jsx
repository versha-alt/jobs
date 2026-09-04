import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { api } from './api.js';
import { onToast, toast } from './toast.js';
import { classifyError } from './errors.js';
import { CountUp, EASE, Icon, timeAgo } from './components/ui.jsx';
import Searches from './components/Searches.jsx';
import Triggers from './components/Triggers.jsx';
import Runs from './components/Runs.jsx';
import Settings from './components/Settings.jsx';

const TABS = [
  { id: 'searches', label: 'Searches', icon: 'search' },
  { id: 'scheduling', label: 'Scheduling', icon: 'clock' },
  { id: 'runs', label: 'Runs', icon: 'zap' },
  { id: 'settings', label: 'Settings', icon: 'globe' },
];

function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(
    () =>
      onToast((t) => {
        setItems((xs) => [...xs.slice(-4), t]);
        const ttl = t.kind === 'error' ? 8000 : 5000;
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), ttl);
      }),
    []
  );
  return (
    <div className="toast-host">
      <AnimatePresence>
        {items.map((t) => (
          <motion.button
            key={t.id}
            layout
            type="button"
            className={`toast toast-${t.kind}`}
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
          >
            {t.msg}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

function HealthBadge({ ok, on, off }) {
  return (
    <span className={`pill ${ok ? 'pill-ok' : 'pill-warn'}`}>
      <span className={`dot dot-${ok ? 'ok' : 'warn'}`} />
      {ok ? on : off}
    </span>
  );
}

function StatsBar({ searches, triggers, runs }) {
  const newJobs = (runs ?? []).reduce(
    (a, r) => a + (r.status === 'success' ? r.new_jobs_count : 0),
    0
  );
  const last = runs?.[0];
  const items = [
    { label: 'Searches', value: searches ? String(searches.length) : '–' },
    { label: 'Triggers', value: triggers ? String(triggers.length) : '–' },
    { label: 'New jobs (recent runs)', value: runs ? <CountUp value={newJobs} /> : '–' },
    { label: 'Last run', value: last ? timeAgo(last.finished_at || last.started_at) : '–' },
  ];
  return (
    <div className="stats">
      {items.map((it) => (
        <div key={it.label} className="stat">
          <span className="stat-num">{it.value}</span>
          <span className="stat-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('searches');
  const [countries, setCountries] = useState([]);
  const [searches, setSearches] = useState(null);
  const [triggers, setTriggers] = useState(null);
  const [runs, setRuns] = useState(null);
  const [health, setHealth] = useState(null);
  const lastSeen = useRef(new Date().toISOString());

  const loadCountries = useCallback(async () => {
    try {
      setCountries(await api.countries.list());
    } catch {
      /* server offline */
    }
  }, []);

  const loadSearches = useCallback(async () => {
    try {
      setSearches(await api.searches.list());
    } catch {
      /* server offline */
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      setTriggers(await api.triggers.list());
    } catch {
      /* server offline */
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await api.runs.list());
    } catch {
      /* server offline */
    }
  }, []);

  useEffect(() => {
    loadCountries();
    loadSearches();
    loadTriggers();
    loadRuns();
    const poll = async () => {
      try {
        setHealth(await api.health());
      } catch {
        setHealth(null);
      }
    };
    poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
  }, [loadCountries, loadSearches, loadTriggers, loadRuns]);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const fresh = await api.runs.since(lastSeen.current);
        lastSeen.current = new Date().toISOString();
        for (const r of fresh) {
          const moduleName = r.module === 'linkedin' ? 'LinkedIn' : 'Upwork';
          if (r.status === 'error') {
            toast.error(`${moduleName}: ${classifyError(r.error).title}`);
          } else if (r.new_jobs_count > 0) {
            if ((r.delivery || '').startsWith('failed')) {
              const cls = classifyError(r.delivery.slice('failed'.length).replace(/^[:\s]+/, ''));
              toast.error(
                `${moduleName} — ${r.new_jobs_count} new job${r.new_jobs_count === 1 ? '' : 's'} found, but ${cls.title.toLowerCase()}`
              );
            } else {
              toast.success(
                `${moduleName} — ${r.new_jobs_count} new job${r.new_jobs_count === 1 ? '' : 's'} delivered`
              );
            }
          }
        }
      } catch {
        /* server offline */
      }
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const reloadAll = () => {
    loadSearches();
    loadTriggers();
    loadRuns();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="shell">
        <header className="header">
          <div>
            <h1>Job Alert Bot</h1>
            <p className="subtitle">LinkedIn &amp; Upwork monitoring via Apify, delivered as CSV to Telegram</p>
          </div>
          <div className="health">
            {health && (
              <>
                <HealthBadge
                  ok={health.apify}
                  on={health.apify ? 'Apify connected' : 'Apify mock mode'}
                />
                <HealthBadge
                  ok={health.telegram}
                  on={health.telegram ? 'Telegram ready' : 'Telegram not set'}
                />
              </>
            )}
          </div>
        </header>

        <StatsBar searches={searches} triggers={triggers} runs={runs} />

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={14} /> {t.label}
              {tab === t.id && (
                <motion.span className="tab-line" layoutId="tab-line" transition={{ duration: 0.25, ease: EASE }} />
              )}
            </button>
          ))}
        </nav>

        <main className="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              {tab === 'searches' && (
                <Searches
                  countries={countries}
                  searches={searches}
                  loading={searches === null}
                  reload={loadSearches}
                />
              )}

              {tab === 'scheduling' && (
                <Triggers
                  searches={searches ?? []}
                  triggers={triggers}
                  loading={triggers === null}
                  reload={loadTriggers}
                  goToListSearches={() => setTab('searches')}
                />
              )}

              {tab === 'runs' && (
                <Runs
                  runs={runs}
                  loading={runs === null}
                  reload={loadRuns}
                  searches={searches ?? []}
                />
              )}

              {tab === 'settings' && (
                <Settings countries={countries} reload={loadCountries} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <ToastHost />
      </div>
    </MotionConfig>
  );
}
