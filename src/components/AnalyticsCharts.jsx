import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getCategoryConfig } from '../constants/categories';

const getCategoryColor = (name) => getCategoryConfig(name).color;

const isDark = () =>
  document.documentElement.classList.contains('dark-theme') ||
  document.body.classList.contains('dark-theme');

const ThemedTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const dark = isDark();
  return (
    <div style={{
      backgroundColor: dark ? '#1e293b' : '#ffffff',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
      borderRadius: '10px', padding: '0.75rem 1rem',
      boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '0.85rem', color: dark ? '#f8fafc' : '#1e293b',
    }}>
      {label && <p style={{ fontWeight: '700', marginBottom: '0.4rem', color: dark ? '#94a3b8' : '#64748b' }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || entry.fill, fontWeight: '600', margin: '0.1rem 0' }}>
          {entry.name} : {Number(entry.value).toFixed(2)} €
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const dark = isDark();
  return (
    <div style={{
      backgroundColor: dark ? '#1e293b' : '#ffffff',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
      borderRadius: '10px', padding: '0.75rem 1rem',
      boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '0.85rem', color: dark ? '#f8fafc' : '#1e293b',
    }}>
      <p style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill || 'var(--primary)', fontWeight: '600' }}>
        {Number(payload[0].value).toFixed(2)} €
      </p>
    </div>
  );
};

/* ─── Donut catégories ─────────────────────────────────────────── */
export const CategoryPieChart = ({ data }) => {
  const chartData = Object.entries(data)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, fill: getCategoryColor(name) }));

  if (!chartData.length) return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
      Aucune dépense ce mois-ci
    </div>
  );

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <div style={{ width: '140px', height: '140px', flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
              {chartData.map((e, i) => <Cell key={i} fill={e.fill} strokeWidth={0} />)}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {chartData.slice(0, 5).map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.fill, flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1 }}>{e.name}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>{e.value.toFixed(0)} €</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', minWidth: '34px', textAlign: 'right' }}>{((e.value / total) * 100).toFixed(0)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Jauge circulaire budget ──────────────────────────────────── */
export const BudgetGauge = ({ spent, total, label = 'utilisé' }) => {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border-color)" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
        <text x="65" y="58" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--text-primary)">{pct.toFixed(0)}%</text>
        <text x="65" y="74" textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{label}</text>
        <text x="65" y="89" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{spent.toFixed(0)} / {total.toFixed(0)} €</text>
      </svg>
    </div>
  );
};

/* ─── Barre cliquable ──────────────────────────────────────────── */
const ClickableBar = (props) => {
  const [hovered, setHovered] = React.useState(false);
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  return (
    <rect x={x} y={y} width={width} height={height} fill={fill}
      opacity={hovered ? 1 : 0.82} rx={4} ry={4}
      style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    />
  );
};

/* ─── Comparatif mois précédents ───────────────────────────────── */
export const MonthlyTrendChart = ({ data }) => {
  const navigate = useNavigate();

  const handleClick = (d) => {
    if (!d?.activeLabel) return;
    const entry = data.find(e => e.name === d.activeLabel);
    if (entry?.monthKey) {
      const [year, month] = entry.monthKey.split('-').map(Number);
      navigate(`/expenses?year=${year}&month=${month - 1}`);
    }
  };

  if (!data?.length) return (
    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
      Pas encore de données
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textAlign: 'right' }}>
        Cliquez sur un mois pour voir les dépenses
      </p>
      <div style={{ height: '220px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} unit="€" width={52} />
            <Tooltip content={<ThemedTooltip />} cursor={{ fill: 'var(--primary-light)', radius: 4 }} />
            <Bar dataKey="foyer" name="Foyer" fill="var(--primary)" shape={<ClickableBar />} barSize={16} />
            <Bar dataKey="perso" name="Perso" fill="#a855f7" shape={<ClickableBar />} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
