import { runActor } from '../apify.js';
import { config } from '../config.js';
import { mockPairs } from '../mock.js';
import { hashId, toIsoMaybe } from '../util.js';

const PUBLISHED_AT = {
  day: 'r86400',
  week: 'r604800',
  month: 'r2592000',
};

export const linkedinModule = {
  id: 'linkedin',
  label: 'LinkedIn',
  actorEnv: 'APIFY_LINKEDIN_ACTOR_ID',
  actorId: () => config.linkedinActorId,
  actorIdExample: 'bebity/linkedin-jobs-scraper',
  inputFields: [
    { key: 'rows', label: 'Rows per search', type: 'number', required: false, default: 40 },
  ],

  async fetch({ search, countries, overrides = {} }) {
    if (!config.apifyToken) return mockPairs(this.id, search, countries);
    if (!this.actorId()) {
      throw new Error(`Set ${this.actorEnv} in .env to your Apify LinkedIn jobs actor id`);
    }
    const rows = Number(overrides.rows) || 40;
    const input = {
      titles: search.keywords,
      ...(countries.length ? { locations: countries } : {}),
      publishedAt: PUBLISHED_AT[search.time_filter] || PUBLISHED_AT.week,
      rows,
    };
    const items = await runActor(this.actorId(), input);
    return items.map((item) => ({
      item,
      keyword: item.scrapingInfo?.title ?? search.keywords.join(' | '),
    }));
  },

  parseItem({ item, keyword }) {
    return {
      job_id: String(item.id ?? hashId('linkedin', item.jobUrl || item.title)),
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
