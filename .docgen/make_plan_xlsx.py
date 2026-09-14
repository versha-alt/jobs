import sys, os, datetime

XLSX_SKILL_DIR = r"C:\Users\dell\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.4\skills\xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

import base
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

base.use_palette_explicit("professional")

OUT = r"C:\Users\dell\Documents\jobs\docs\job-alert-plan.xlsx"

wb = Workbook()

# ---------------- Sheet 1: Day Plan ----------------
ws = wb.active
ws.title = "Day Plan"

HEADERS = ["Date", "Day", "Task", "What it covers", "Status", "Priority", "Outcome / next check"]
LAST_COL = 1 + len(HEADERS)  # data starts at column B

d = datetime.date
ROWS = [
    (d(2026, 9, 4),  "Fri", "Project setup",
     "First working version: dashboard (React), API server, database, LinkedIn + Upwork scrapers connected, mock mode, basic scheduling.",
     "Done", "—", "App ran; first real scraper runs succeeded."),
    (d(2026, 9, 7),  "Mon", "Storage migration & hardening",
     "Moved data from SQLite to MySQL; improved run pipeline and error messages. Old LinkedIn scraper's free trial expired — paid-actor errors discovered.",
     "Done", "—", "Runs and errors recorded in history."),
    (d(2026, 9, 14), "Mon", "LinkedIn fixed end-to-end",
     "Diagnosed 0-jobs cause; switched to curious_coder/linkedin-jobs-scraper; rebuilt search mapping (keywords, country, 24h/week/month window); verified with real runs.",
     "Done", "—", "23-26 real PHP Developer jobs per run; Telegram summary delivered."),
    (d(2026, 9, 14), "Mon", "Reliability fixes",
     "Broken scrapers now show as failed runs (no more silent 0-jobs); retry storm capped; 10-min timeout; stuck 'running' runs auto-closed on restart; live status updates (~2s) with pulsing indicator.",
     "Done", "—", "Verified via restart + live run."),
    (d(2026, 9, 14), "Mon", "Job browsing UI",
     "Full job listing per run (list icon on every run card); job detail page (description, salary/budget, client info, apply link); clickable rows; raw job data saved per run.",
     "Done", "—", "Built; final click-through verification pending (Sep 15)."),
    (d(2026, 9, 14), "Mon", "Upwork diagnosis",
     "Found why Upwork returns 0 jobs: one-time free trial quota exhausted, plus country filter mismatch (client country). Actor probed directly with/without location.",
     "Done", "—", "Documented in PLAN.md; fix scheduled Sep 16-17."),
    (d(2026, 9, 14), "Mon", "Planning docs",
     "Created PLAN.md (plain-language status + to-dos) and this day-by-day tracker.",
     "Done", "—", "—"),

    (d(2026, 9, 15), "Tue", "Publish the new UI",
     "Run the production build (npm run build) so the job listing + detail pages appear on localhost:8787, not just the dev preview; click-test both pages with real run data.",
     "Planned", "High", "Accept: pages visible at :8787, detail page renders a real job."),
    (d(2026, 9, 16), "Wed", "Apify account & billing",
     "Add payment method to the Apify account (Upwork trial quota is exhausted and does not reset); confirm Upwork runs return jobs again; review LinkedIn concurrent-limit failures.",
     "Planned", "High", "Accept: an Upwork run returns >0 jobs."),
    (d(2026, 9, 17), "Thu", "Upwork search fix",
     "Make Upwork search worldwide (drop the client-country filter); keep country filtering for LinkedIn only; verify with a fresh run.",
     "Planned", "High", "Accept: Upwork run returns relevant jobs."),
    (d(2026, 9, 18), "Fri", "Schedule spacing",
     "Space out scheduled triggers so scrapers never run 5-at-once (free plan limit); confirm no more 'concurrent runs limit' failures.",
     "Planned", "Medium", "Accept: a full scheduled day passes without 429 errors."),
    (d(2026, 9, 21), "Mon", "Login / signup",
     "Add user accounts: sign-up flow, login screen, sessions. Prep per-user searches, schedules and Telegram settings.",
     "Planned", "High", "Accept: dashboard requires login; new account can be created."),
    (d(2026, 9, 22), "Tue", "UI improvement pass",
     "Layout and navigation polish, better empty states, clearer status colors, mobile-friendly responsive design across all pages.",
     "Planned", "Medium", "Accept: pages consistent and usable on a phone-sized window."),
    (d(2026, 9, 23), "Wed", "Job detail enhancements",
     "Polish the job detail page; add save/bookmark job and copy-link actions; verify every field renders for both LinkedIn and Upwork jobs.",
     "Planned", "Medium", "Accept: bookmark survives reload."),
    (d(2026, 9, 24), "Thu", "Reliability extras",
     "Show a distinct 'quota used up' status instead of a plain 0-jobs success; warn when attaching a duplicate schedule to a search; expire old seen-job records.",
     "Planned", "Medium", "Accept: exhausted quota is obvious from the run card."),
    (d(2026, 9, 25), "Fri", "Docs cleanup",
     "Update README (remove outdated CSV/SQLite claims and leftover merge text); keep PLAN.md and this tracker current.",
     "Planned", "Low", "Accept: README matches reality."),
]

base.setup_sheet(ws, title="Job Alert Bot — Day-by-Day Plan (status as of 14 Sep 2026)", last_col=LAST_COL)

for col, h in enumerate(HEADERS, 2):
    ws.cell(row=4, column=col, value=h)
base.style_header_row(ws, 4, 2, LAST_COL)

r = 5
for i, (date, day, task, covers, status, prio, outcome) in enumerate(ROWS):
    ws.cell(row=r, column=2, value=date).number_format = "dd mmm yyyy"
    ws.cell(row=r, column=3, value=day)
    ws.cell(row=r, column=4, value=task)
    ws.cell(row=r, column=5, value=covers)
    ws.cell(row=r, column=6, value=status)
    ws.cell(row=r, column=7, value=prio)
    ws.cell(row=r, column=8, value=outcome)
    base.style_data_row(ws, r, 2, LAST_COL, i)
    # semantic status colors
    sc = ws.cell(row=r, column=6)
    if status == "Done":
        sc.font = Font(name=base.FONT_NAME, size=11, color=base.ACCENT_POSITIVE, bold=base.HEADER_BOLD)
    else:
        sc.font = Font(name=base.FONT_NAME, size=11, color=base.ACCENT_WARNING, bold=base.HEADER_BOLD)
    sc.alignment = Alignment(horizontal="center", vertical="center")
    ws.cell(row=r, column=2).alignment = Alignment(horizontal="center", vertical="center")
    ws.cell(row=r, column=3).alignment = Alignment(horizontal="center", vertical="center")
    pc = ws.cell(row=r, column=7)
    pc.alignment = Alignment(horizontal="center", vertical="center")
    if prio == "High":
        pc.font = Font(name=base.FONT_NAME, size=11, color=base.ACCENT_NEGATIVE)
    r += 1

last_data = r - 1
note_row = last_data + 2
ws.cell(row=note_row, column=2,
        value="Done = completed and verified.  Planned = scheduled ahead (dates shift if priorities change).  Details live in PLAN.md at the project root.")
ws.cell(row=note_row, column=2).font = base.font_caption()

base.auto_fit_columns(ws, min_width=8, max_width=46, header_row=4, data_start_row=5)
base.auto_fit_row_heights(ws, header_row=4, data_start_row=5)
ws.freeze_panes = "D5"

# ---------------- Sheet 2: Scrapers & Costs ----------------
ws2 = wb.create_sheet("Scrapers & Costs")
H2 = ["Source", "Apify actor", "How it is priced", "Free tier", "Status today", "Notes"]
LAST2 = 1 + len(H2)

base.setup_sheet(ws2, title="Scrapers In Use — Actors & Pricing", last_col=LAST2)
for col, h in enumerate(H2, 2):
    ws2.cell(row=4, column=col, value=h)
base.style_header_row(ws2, 4, 2, LAST2)

REF = [
    ("LinkedIn", "curious_coder/linkedin-jobs-scraper",
     "Pay per result: about $1.00 per 1,000 job results. No monthly fee; heavier Apify plans lower the rate. A typical daily run (~25 jobs) costs well under a cent.",
     "No actor-specific free tier. Account-level free plan caps at 5 actor runs at the same time.",
     "Working",
     "Verified 14 Sep: 23-26 real jobs per run, Telegram delivered."),
    ("Upwork", "neatrat/upwork-job-scraper",
     "Pay per result: about $3.20 per 1,000 jobs. Every run is billed a minimum of 10 jobs even if it finds none.",
     "One-time trial: about 10 runs and 100 results in total. Does NOT reset monthly. Trial runs count even when they return zero jobs.",
     "Quota exhausted",
     "Returns 0 jobs until a payment method is added to the Apify account. Country filter means client country - worldwide search planned (Sep 17)."),
]

r2 = 5
for i, row in enumerate(REF):
    for col, v in enumerate(row, 2):
        ws2.cell(row=r2, column=col, value=v)
    base.style_data_row(ws2, r2, 2, LAST2, i)
    st = ws2.cell(row=r2, column=6)
    if row[4] == "Working":
        st.font = Font(name=base.FONT_NAME, size=11, color=base.ACCENT_POSITIVE, bold=base.HEADER_BOLD)
    else:
        st.font = Font(name=base.FONT_NAME, size=11, color=base.ACCENT_NEGATIVE, bold=base.HEADER_BOLD)
    st.alignment = Alignment(horizontal="center", vertical="center")
    r2 += 1

note2 = r2 + 2
ws2.cell(row=note2, column=2,
         value="The Apify API key lives in the project's .env file (never share it). Scraper usage is billed by Apify directly - more frequent schedules = higher cost.")
ws2.cell(row=note2, column=2).font = base.font_caption()

base.auto_fit_columns(ws2, min_width=10, max_width=46, header_row=4, data_start_row=5)
base.auto_fit_row_heights(ws2, header_row=4, data_start_row=5)
ws2.freeze_panes = "C5"

wb.properties.creator = "Z.ai"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print("saved", OUT)
