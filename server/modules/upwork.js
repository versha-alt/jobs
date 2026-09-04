import { runActor } from '../apify.js';
import { config } from '../config.js';
import { mockPairs } from '../mock.js';
import { hashId, toIsoMaybe } from '../util.js';

const MAX_JOB_AGE = {
  day: { value: 24, unit: 'hours' },
  week: { value: 7, unit: 'days' },
  month: { value: 30, unit: 'days' },
};

const COUNTRY_ALIASES = {
  USA: 'United States',
  UK: 'United Kingdom',
};

function mapCountry(name) {
  return COUNTRY_ALIASES[name] ?? name;
}

function locationString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.country ?? value.name ?? value.label ?? '';
  return String(value);
}

function budgetString(budget) {
  if (typeof budget === 'string') return budget;
  if (budget && typeof budget === 'object') {
    if (budget.min != null || budget.max != null) {
      return `$${budget.min ?? '?'} - $${budget.max ?? '?'}`;
    }
    if (budget.minFloat != null || budget.maxFloat != null) {
      return `$${budget.minFloat ?? '?'} - $${budget.maxFloat ?? '?'}`;
    }
  }
  return '';
}

export const upworkModule = {
  id: 'upwork',
  label: 'Upwork',
  actorEnv: 'APIFY_UPWORK_ACTOR_ID',
  actorId: () => config.upworkActorId,
  actorIdExample: 'neatrat/upwork-job-scraper',
  inputFields: [],

  async fetch({ search, countries }) {
    if (!config.apifyToken) return mockPairs(this.id, search, countries);
    if (!this.actorId()) {
      throw new Error(`Set ${this.actorEnv} in .env to your Apify Upwork scraper actor id`);
    }
    const locs = countries.map(mapCountry);
    const pairs = [];
    for (const kw of search.keywords) {
      const input = {
        query: kw,
        maxJobAge: MAX_JOB_AGE[search.time_filter] ?? MAX_JOB_AGE.week,
        perPage: 50,
        pagesToScrape: 1,
        sort: 'newest',
      };
      if (locs.length) input.location = locs;
      const items = await runActor(this.actorId(), input);
      for (const item of items) pairs.push({ item, keyword: kw });
    }
    return pairs;
  },

  parseItem({ item, keyword }) {
    const budgetStr = budgetString(item.budget);
    return {
      job_id: String(item.id ?? hashId('upwork', item.url || item.title)),
      title: item.title ?? 'Untitled',
      company: item.clientName || (budgetStr ? `Client (${budgetStr})` : 'Client'),
      location: locationString(item.clientLocation ?? item.location),
      url: item.url ?? '',
      posted_date: toIsoMaybe(item.absoluteDate ?? item.postedAt ?? item.publishedAt),
      source: 'upwork',
      matched_keywords: [keyword].filter(Boolean),
    };
  },
};
