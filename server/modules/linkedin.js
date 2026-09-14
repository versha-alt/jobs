import { runActor } from '../apify.js';
import { config } from '../config.js';
import { mockPairs } from '../mock.js';
import { hashId, toIsoMaybe } from '../util.js';

// curious_coder/linkedin-jobs-scraper takes ONE keywords+location pair per run
// and speaks its own datePosted vocabulary; keywords x countries become
// parallel actor runs.
const DATE_POSTED = {
  day: 'past24Hours',
  week: 'pastWeek',
  month: 'pastMonth',
};

export const linkedinModule = {
  id: 'linkedin',
  label: 'LinkedIn',
  actorEnv: 'APIFY_LINKEDIN_ACTOR_ID',
  actorId: () => config.linkedinActorId,
  actorIdExample: 'curious_coder/linkedin-jobs-scraper',
  inputFields: [
    { key: 'rows', label: 'Rows per search', type: 'number', required: false, default: 40 },
  ],

  async fetch({ search, countries, overrides = {} }) {
    if (!config.apifyToken) return mockPairs(this.id, search, countries);
    if (!this.actorId()) {
      throw new Error(`Set ${this.actorEnv} in .env to your Apify LinkedIn jobs actor id`);
    }
    const rows = Number(overrides.rows) || 40;
    const datePosted = DATE_POSTED[search.time_filter] || DATE_POSTED.week;
    const combos = [];
    for (const keyword of search.keywords) {
      for (const location of countries.length ? countries : [undefined]) {
        combos.push({ keyword, location });
      }
    }
    const batches = await Promise.all(
      combos.map(({ keyword, location }) =>
        runActor(this.actorId(), {
          keywords: keyword,
          ...(location ? { location } : {}),
          datePosted,
          limitPerSource: rows,
        }).then((items) => items.map((item) => ({ item, keyword })))
      )
    );
    return batches.flat();
  },

  parseItem({ item, keyword }) {
    return {
      job_id: String(item.id ?? hashId('linkedin', item.link || item.jobUrl || item.title)),
      title: item.title ?? 'Untitled',
      company: item.companyName ?? item.company ?? '',
      location: item.location ?? '',
      url: item.jobUrl ?? item.link ?? '',
      posted_date: toIsoMaybe(item.publishedAt ?? item.postedAt),
      source: 'linkedin',
      matched_keywords: [keyword].filter(Boolean),
    };
  },
};
