p = 'src/App.jsx'
s = open(p, encoding='utf8').read()

s = s.replace(
    "import ScheduleDetail from './components/ScheduleDetail.jsx';",
    "import Routines from './components/Routines.jsx';\nimport RoutineForm from './components/RoutineForm.jsx';\nimport RoutineDetail from './components/RoutineDetail.jsx';"
)
s = s.replace(
    "const TABS = [\n  { id: 'overview', label: 'Overview', icon: 'grid' },\n  { id: 'searches', label: 'Searches', icon: 'search' },\n  { id: 'scheduling', label: 'Scheduling', icon: 'clock' },\n  { id: 'runs', label: 'Runs', icon: 'zap' },",
    "const TABS = [\n  { id: 'overview', label: 'Overview', icon: 'grid' },\n  { id: 'routines', label: 'Routines', icon: 'search' },\n  { id: 'runs', label: 'Runs', icon: 'zap' },"
)

old = """function StatsBar({ searches, triggers, runs }) {
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
  ];"""
new = """function StatsBar({ routines, runs }) {
  const newJobs = (runs ?? []).reduce(
    (a, r) => a + (r.status === 'success' ? r.new_jobs_count : 0),
    0
  );
  const last = runs?.[0];
  const activeSchedules = (routines ?? []).reduce((a, r) => a + (r.active_schedules ?? 0), 0);
  const items = [
    { label: 'Routines', value: routines ? String(routines.length) : '–' },
    { label: 'Active schedules', value: routines ? String(activeSchedules) : '–' },
    { label: 'New jobs (recent runs)', value: runs ? <CountUp value={newJobs} /> : '–' },
    { label: 'Last run', value: last ? timeAgo(last.finished_at || last.started_at) : '–' },
  ];"""
assert old in s, 'StatsBar not found'
s = s.replace(old, new)

s = s.replace(
    "function Overview({ searches, triggers, runs, onGoTo }) {",
    "function Overview({ routines, runs, onGoTo }) {"
)
old = """        {card(
          'Automation setup',
          [
            ['Saved searches', searches ? searches.length : <Spinner />],
            ['Scheduled triggers', triggers ? triggers.length : <Spinner />],
            ['Next scheduled run', triggers && triggers.length ? (
              <Countdown iso={[...triggers].sort((a, b) => (a.next_run_at ?? '9999').localeCompare(b.next_run_at ?? '9999'))[0].next_run_at} />
            ) : '—'],
          ],
          'scheduling'
        )}"""
new = """        {card(
          'Automation setup',
          [
            ['Routines', routines ? routines.length : <Spinner />],
            ['Active schedules', routines ? routines.reduce((a, r) => a + (r.active_schedules ?? 0), 0) : <Spinner />],
            ['Next scheduled run', routines && routines.some((r) => r.next_run_at) ? (
              <Countdown iso={routines.filter((r) => r.next_run_at).map((r) => r.next_run_at).sort()[0]} />
            ) : '—'],
          ],
          'routines'
        )}"""
assert old in s, 'automation card not found'
s = s.replace(old, new)

s = s.replace(
    "  const [searches, setSearches] = useState(null);\n  const [triggers, setTriggers] = useState(null);",
    "  const [routines, setRoutines] = useState(null);"
)
old = """  const loadSearches = useCallback(async () => {
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
  }, []);"""
new = """  const loadRoutines = useCallback(async () => {
    try {
      setRoutines(await api.routines.list());
    } catch {
      /* server offline */
    }
  }, []);"""
assert old in s, 'loaders not found'
s = s.replace(old, new)

s = s.replace(
    "    loadCountries();\n    loadSearches();\n    loadTriggers();\n    loadRuns();",
    "    loadCountries();\n    loadRoutines();\n    loadRuns();"
)
s = s.replace(
    "  }, [loadCountries, loadSearches, loadTriggers, loadRuns]);",
    "  }, [loadCountries, loadRoutines, loadRuns]);"
)
s = s.replace(
    "    setSearches(null);\n    setTriggers(null);\n    setRuns(null);",
    "    setRoutines(null);\n    setRuns(null);"
)
s = s.replace(
    "  const { scheduleId, runId } = useParams();",
    "  const { id: paramRoutineId, runId } = useParams();"
)
s = s.replace(
    "function Dashboard() {",
    "function Dashboard({ routineForm }) {"
)

old = """        <div className="canvas">
          <div className="shell">
            {scheduleId ? (
              <ScheduleDetail
                scheduleId={scheduleId}
                runId={runId}
                searches={searches ?? []}
                onRunStarted={() => loadRuns()}
              />
            ) : jobView ? ("""
new = """        <div className="canvas">
          <div className="shell">
            {routineForm ? (
              <RoutineForm mode={routineForm} routineId={paramRoutineId} />
            ) : paramRoutineId ? (
              <RoutineDetail routineId={paramRoutineId} runId={runId} />
            ) : jobView ? ("""
assert old in s, 'canvas anchor missing'
s = s.replace(old, new)

old = """                  {tab === 'overview' && (
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
                  )}"""
new = """                  {tab === 'overview' && (
                    <Overview routines={routines} runs={runs} onGoTo={setTab} />
                  )}

                  {tab === 'routines' && (
                    <Routines
                      routines={routines}
                      loading={routines === null}
                      reload={loadRoutines}
                      onOpen={(id) => navigate(`/routines/${id}`)}
                      onEdit={(id) => navigate(`/routines/${id}/edit`)}
                      onNew={() => navigate('/routines/new')}
                    />
                  )}"""
assert old in s, 'tab content anchor missing'
s = s.replace(old, new)

s = s.replace(
    """                  {tab === 'jobs' && (
                    <Jobs
                      searches={searches ?? []}""",
    """                  {tab === 'jobs' && (
                    <Jobs
                      routines={routines ?? []}"""
)

old = """          <Route path="/schedule/:scheduleId" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/schedule/:scheduleId/history/:runId" element={<RequireAuth><Dashboard /></RequireAuth>} />"""
new = """          <Route path="/routines" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/routines/new" element={<RequireAuth><Dashboard routineForm="new" /></RequireAuth>} />
          <Route path="/routines/:id/edit" element={<RequireAuth><Dashboard routineForm="edit" /></RequireAuth>} />
          <Route path="/routines/:id" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/routines/:id/history/:runId" element={<RequireAuth><Dashboard /></RequireAuth>} />"""
assert old in s, 'schedule routes not found'
s = s.replace(old, new)

open(p, 'w', encoding='utf8', newline='\n').write(s)
print('App.jsx rewired ok')
