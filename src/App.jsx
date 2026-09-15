import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { api } from './api.js';
import { onToast, toast } from './toast.js';
import { classifyError } from './errors.js';
import { Countdown, CountUp, EASE, Icon, Spinner, timeAgo } from './components/ui.jsx';
import Searches from './components/Searches.jsx';
import Triggers from './components/Triggers.jsx';
import Runs from './components/Runs.jsx';
import RunJobs from './components/RunJobs.jsx';
import JobDetail from './components/JobDetail.jsx';
import Jobs from './components/Jobs.jsx';
import JobsDetail from './components/JobsDetail.jsx';
import AuthPage from './components/AuthPage.jsx';
import Settings from './components/Settings.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'searches', label: 'Searches', icon: 'search' },
  { id: 'scheduling', label: 'Scheduling', icon: 'clock' },
  { id: 'runs', label: 'Runs', icon: 'zap' },
  { id: 'jobs', label: 'Jobs', icon: 'list' },
  { id: 'settings', label: 'Settings', icon: 'globe' },
];

/* auth state lives above the router so /login and /dashboard both react to it */
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthLoading() {
  return (
    <div className="auth-shell">
      <div className="auth-checking">Loading…</div>
    </div>
  );
}

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

/* /login — auth form only when signed out; signed-in visitors go to /dashboard */
function LoginRoute() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  if (user === undefined) return <AuthLoading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <AuthPage
      onAuthed={(u) => {
        setUser(u);
        navigate('/dashboard', { replace: true });
      }}
    />
  );
}

/* /dashboard — requires a session; unauthenticated visitors land on /login */
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/* any other path: authed users to the dashboard, everyone else to /login */
function CatchAll() {
  const { user } = useAuth();
  if (user === undefined) return <AuthLoading />;
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function Overview({ searches, triggers, runs, onGoTo }) {
  const [jobStats, setJobStats] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.jobs.list({ page: 1, pageSize: 1 }),
      api.jobs.list({ page: 1, pageSize: 1, source: 'linkedin' }),
      api.jobs.list({ page: 1, pageSize: 1, source: 'upwork' }),
    ])
      .then(([all, li, up]) => {
        if (alive) setJobStats({ total: all.total, linkedin: li.total, upwork: up.total });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const runsLoaded = runs ?? [];
  const okRuns = runsLoaded.filter((r) => r.status === 'success').length;
  const failedRuns = runsLoaded.filter((r) => r.status === 'error').length;

  const card = (title, rows, goTo) => (
    <div className="card an-card">
      <div className="an-head">
        <span className="an-title">{title}</span>
        {goTo && (
          <button type="button" className="an-link" onClick={() => onGoTo(goTo)}>
            view all
          </button>
        )}
      </div>
      {rows.map(([label, value]) => (
        <div className="an-row" key={label}>
          <span className="an-label">{label}</span>
          <span className="an-value">{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="section-head">
        <h2>Overview</h2>
      </div>

      <StatsBar searches={searches} triggers={triggers} runs={runs} />

      <div className="analysis-grid">
        {card(
          'Jobs by platform',
          [
            ['Total unique jobs', jobStats ? jobStats.total : <Spinner />],
            ['LinkedIn', jobStats ? jobStats.linkedin : <Spinner />],
            ['Upwork', jobStats ? jobStats.upwork : <Spinner />],
          ],
          'jobs'
        )}
        {card(
          'Run outcomes (recent)',
          [
            ['Successful runs', okRuns],
            ['Failed runs', failedRuns],
            ['Runs recorded', runsLoaded.length],
          ],
          'runs'
        )}
        {card(
          'Automation setup',
          [
            ['Saved searches', searches ? searches.length : <Spinner />],
            ['Scheduled triggers', triggers ? triggers.length : <Spinner />],
            ['Next scheduled run', triggers && triggers.length ? (
              <Countdown iso={[...triggers].sort((a, b) => (a.next_run_at ?? '9999').localeCompare(b.next_run_at ?? '9999'))[0].next_run_at} />
            ) : '—'],
          ],
          'scheduling'
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [countries, setCountries] = useState([]);
  const [searches, setSearches] = useState(null);
  const [triggers, setTriggers] = useState(null);
  const [runs, setRuns] = useState(null);
  const [health, setHealth] = useState(null);
  const [highlightRunId, setHighlightRunId] = useState(null);
  const [jobsRunId, setJobsRunId] = useState(null);
  const [jobsDetailId, setJobsDetailId] = useState(null);
  const [jobView, setJobView] = useState(null);
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

  // poll for finished-run toasts fast while something is in flight
  const hasActiveRuns = (runs ?? []).some((r) => r.status === 'running');
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
    }, hasActiveRuns ? 2000 : 8000);
    return () => clearInterval(t);
  }, [hasActiveRuns]);

  const signOut = async () => {
    try {
      await api.auth.logout();
    } catch {
      /* session already gone */
    }
    setUser(null);
    setJobsRunId(null);
    setJobView(null);
    setJobsDetailId(null);
    setSearches(null);
    setTriggers(null);
    setRuns(null);
    navigate('/login', { replace: true });
  };

  const switchToRuns = useCallback(
    (runId) => {
      setHighlightRunId(runId);
      setTab('runs');
      loadRuns();
      setTimeout(loadRuns, 1200);
      setTimeout(loadRuns, 3000);
    },
    [loadRuns]
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-frame">
        <aside className="sidebar">
          <div className="sb-brand">
            <span className="brand-mark">
              <Icon name="zap" size={18} />
            </span>
            <div className="sb-brand-text">
              <div className="sb-title">Job Portal</div>
            </div>
          </div>

          <nav className="sb-nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`sb-item${tab === t.id ? ' on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={15} /> {t.label}
              </button>
            ))}
          </nav>

          <div className="sb-foot">
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
            <span className="pill pill-muted auth-user-chip" title={user.email}>
              <span className="dot dot-ok" />
              {user.name}
            </span>
            <button type="button" className="btn btn-ghost btn-icon" onClick={signOut} aria-label="Sign out" title="Sign out">
              <Icon name="logout" />
            </button>
          </div>
        </aside>

        <div className="canvas">
          <div className="shell">
            {jobView ? (
          <JobDetail
            runId={jobView.runId}
            jobRef={{ source: jobView.source, jobId: jobView.jobId }}
            onBack={() => setJobView(null)}
          />
        ) : jobsDetailId ? (
          <JobsDetail
            jobId={jobsDetailId}
            onBack={() => setJobsDetailId(null)}
            onOpenRun={(runId) => {
              setJobsDetailId(null);
              setJobsRunId(runId);
            }}
          />
        ) : jobsRunId ? (
          <RunJobs
            runId={jobsRunId}
            onBack={() => setJobsRunId(null)}
            onOpenJob={(run, job) =>
              setJobView({ runId: run.id, source: job.source, jobId: job.job_id })
            }
            searchLabel={
              ((searches ?? []).find((s) => s.id === (runs ?? []).find((r) => r.id === jobsRunId)?.search_id) ?? {})
                .keywords?.join(', ') ?? ''
            }
          />
        ) : (
          <main className="main">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: EASE }}
              >
                  {tab === 'overview' && (
                    <Overview searches={searches} triggers={triggers} runs={runs} onGoTo={setTab} />
                  )}

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
                      onRunStarted={switchToRuns}
                    />
                  )}

                  {tab === 'runs' && (
                    <Runs
                      runs={runs}
                      loading={runs === null}
                      reload={loadRuns}
                      searches={searches ?? []}
                      highlightRunId={highlightRunId}
                      onOpenJobs={(run) => setJobsRunId(run.id)}
                      onOpenJob={(run, job) =>
                        setJobView({ runId: run.id, source: job.source, jobId: job.job_id })
                      }
                    />
                  )}

                  {tab === 'jobs' && (
                    <Jobs
                      searches={searches ?? []}
                      onOpenJob={(id) => setJobsDetailId(id)}
                      onOpenRun={(runId) => setJobsRunId(runId)}
                    />
                  )}

              {tab === 'settings' && (
                <Settings countries={countries} reload={loadCountries} user={user} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        )}

        <ToastHost />
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session, null = signed out

  useEffect(() => {
    api.auth
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  return (
    <AuthCtx.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="*" element={<CatchAll />} />
        </Routes>
        <ToastHost />
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}
