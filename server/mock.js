import { hashId } from './util.js';

const COMPANIES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella LLC'];

export function mockPairs(moduleId, search, countries) {
  const locs = countries.length ? countries : ['Remote'];
  const windows = { day: 1, week: 7, month: 30 };
  const days = windows[search.time_filter] ?? 7;
  const pairs = [];

  search.keywords.forEach((kw, ki) => {
    const count = 2 + ((kw.length + ki) % 3);
    for (let k = 0; k < count; k++) {
      const id = `mock_${hashId(moduleId, kw.toLowerCase(), k)}`;
      const postedAt = new Date(
        Date.now() - (((ki * 7 + k * 13) % (days * 24)) + 1) * 3600e3
      ).toISOString();
      const base = {
        id,
        title: `${titleCase(kw)} (${moduleId === 'linkedin' ? 'On-site' : 'Freelance'})`,
        location: locs[(ki + k) % locs.length],
        postedAt,
      };
      pairs.push({
        keyword: kw,
        item:
          moduleId === 'linkedin'
            ? {
                ...base,
                companyName: COMPANIES[(ki + k) % COMPANIES.length],
                jobUrl: `https://example.com/linkedin/jobs/${id}`,
              }
            : {
                ...base,
                client: { location: locs[(ki + k) % locs.length] },
                budget: { min: 500 + k * 250, max: 1500 + k * 500 },
                url: `https://example.com/upwork/jobs/${id}`,
              },
      });
    }
  });

  return pairs;
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
