import crypto from 'node:crypto';

export const uid = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}`;

export const nowIso = () => new Date().toISOString();

export function hashId(...parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

export const TIME_FILTERS = ['day', 'week', 'month'];
export const TIME_FILTER_DEFAULT = 'week';
export const TIME_FILTER_MS = {
  day: 24 * 3600e3,
  week: 7 * 24 * 3600e3,
  month: 30 * 24 * 3600e3,
};

export const MODULES = ['linkedin', 'upwork'];
export const FREQUENCIES = ['hourly', 'daily', 'weekly'];

export function cutoffIso(timeFilter) {
  const ms = TIME_FILTER_MS[timeFilter] ?? TIME_FILTER_MS[TIME_FILTER_DEFAULT];
  return new Date(Date.now() - ms).toISOString();
}

export function toIsoMaybe(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function computeNextRun(frequency, time, daysOfWeek, from = new Date()) {
  const [h, m] = String(time || '09:00').split(':').map(Number);
  const day = 86400000;
  const at = (d) => {
    const x = new Date(d);
    x.setHours(h, m, 0, 0);
    return x;
  };

  if (frequency === 'hourly') {
    const x = new Date(from);
    x.setMinutes(m || 0, 0, 0);
    if (x <= from) x.setTime(x.getTime() + 3600000);
    return x;
  }

  if (frequency === 'daily') {
    let x = at(from);
    if (x <= from) x = at(from.getTime() + day);
    return x;
  }

  const dows = Array.isArray(daysOfWeek) ? daysOfWeek : [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(from.getTime() + i * day);
    const isoDow = ((d.getDay() + 6) % 7) + 1;
    if (dows.includes(isoDow)) {
      const x = at(d);
      if (x > from) return x;
    }
  }
  return at(from.getTime() + 7 * day);
}
