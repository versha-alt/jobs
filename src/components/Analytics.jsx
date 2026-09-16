import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../api.js';
import { Spinner } from './ui.jsx';

// mirrors the palette in styles.css :root — recharts needs literal color
// values, CSS custom properties in SVG fill/stroke aren't reliable enough
// across browsers to depend on here
const COLOR = {
  linkedin: '#c2542b', // --accent
  upwork: '#2e4b3f', // --forest
  muted: '#7c7263', // --muted
  border: '#e4d9c6', // --border
  text2: '#4a4237', // --text-2
};

const tooltipStyle = {
  background: '#fffdf8',
  border: '1px solid #e4d9c6',
  borderRadius: 10,
  fontSize: 12.5,
  boxShadow: '0 1px 2px rgba(34,26,16,0.05), 0 12px 32px rgba(34,26,16,0.07)',
};

function ChartCard({ title, loading, empty, emptyHint, onViewAll, children }) {
  return (
    <div className="card an-card chart-card">
      <div className="an-head">
        <span className="an-title">{title}</span>
        {onViewAll && (
          <button type="button" className="an-link" onClick={onViewAll}>
            view all
          </button>
        )}
      </div>
      {loading ? (
        <div className="chart-state">
          <Spinner />
        </div>
      ) : empty ? (
        <div className="chart-state chart-empty">{emptyHint}</div>
      ) : (
        <div className="chart-body">{children}</div>
      )}
    </div>
  );
}

function fmtDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export function JobsByDayChart() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    api.analytics
      .jobsByDay(14)
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const loading = rows === null;
  const empty = !loading && rows.length === 0;

  let series = [];
  if (!loading && !empty) {
    const days = [...new Set(rows.map((r) => r.day))].sort();
    series = days.map((day) => {
      const byDay = rows.filter((r) => r.day === day);
      return {
        day: fmtDay(day),
        linkedin: byDay.find((r) => r.source === 'linkedin')?.count ?? 0,
        upwork: byDay.find((r) => r.source === 'upwork')?.count ?? 0,
      };
    });
  }

  return (
    <ChartCard
      title="Jobs fetched per day"
      loading={loading}
      empty={empty}
      emptyHint="No fetch activity in the last 14 days yet."
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={COLOR.border} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={{ stroke: COLOR.border }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: COLOR.text2, fontWeight: 600 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: COLOR.text2 }} iconType="circle" iconSize={8} />
          <Area type="monotone" dataKey="linkedin" name="LinkedIn" stackId="1" stroke={COLOR.linkedin} fill={COLOR.linkedin} fillOpacity={0.25} />
          <Area type="monotone" dataKey="upwork" name="Upwork" stackId="1" stroke={COLOR.upwork} fill={COLOR.upwork} fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function JobsByLocationChart() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    api.analytics
      .jobsByLocation()
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const loading = rows === null;
  const empty = !loading && rows.length === 0;
  const data = (rows ?? [])
    .slice()
    .reverse()
    .map((r) => ({ location: r.location.length > 26 ? `${r.location.slice(0, 25)}…` : r.location, count: r.count }));

  return (
    <ChartCard
      title="Jobs by location"
      loading={loading}
      empty={empty}
      emptyHint="No jobs with a known location yet."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={COLOR.border} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={{ stroke: COLOR.border }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="location"
            width={140}
            tick={{ fontSize: 11.5, fill: COLOR.text2 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: COLOR.text2, fontWeight: 600 }} cursor={{ fill: 'rgba(194,84,43,0.06)' }} />
          <Bar dataKey="count" name="Jobs" fill={COLOR.linkedin} radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SourceYieldChart() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    api.analytics
      .sourceYield()
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const loading = rows === null;
  const empty = !loading && rows.length === 0;
  const data = (rows ?? []).map((r) => ({
    module: r.module === 'linkedin' ? 'LinkedIn' : 'Upwork',
    'Total found': r.totalFound,
    'New jobs': r.newJobs,
  }));

  return (
    <ChartCard
      title="Source yield: found vs new"
      loading={loading}
      empty={empty}
      emptyHint="No completed runs yet."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={COLOR.border} vertical={false} />
          <XAxis dataKey="module" tick={{ fontSize: 12, fill: COLOR.text2 }} axisLine={{ stroke: COLOR.border }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: COLOR.text2, fontWeight: 600 }} cursor={{ fill: 'rgba(194,84,43,0.06)' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: COLOR.text2 }} iconType="circle" iconSize={8} />
          <Bar dataKey="Total found" fill={COLOR.linkedin} radius={[4, 4, 0, 0]} barSize={22} />
          <Bar dataKey="New jobs" fill={COLOR.upwork} radius={[4, 4, 0, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function JobsByPlatformChart({ onViewAll }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    api.analytics
      .jobsByPlatform()
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const loading = rows === null;
  const total = (rows ?? []).reduce((a, r) => a + r.count, 0);
  const empty = !loading && total === 0;
  const data = (rows ?? []).map((r) => ({
    name: r.source === 'linkedin' ? 'LinkedIn' : 'Upwork',
    value: r.count,
    color: r.source === 'linkedin' ? COLOR.linkedin : COLOR.upwork,
  }));

  return (
    <ChartCard title="Jobs by platform" loading={loading} empty={empty} emptyHint="No jobs fetched yet." onViewAll={onViewAll}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} (${((v / total) * 100).toFixed(1)}%)`, n]} />
          <Legend wrapperStyle={{ fontSize: 12, color: COLOR.text2 }} iconType="circle" iconSize={8} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} stroke="none" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
