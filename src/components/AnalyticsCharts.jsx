import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getCategoryConfig } from '../constants/categories';

const getCategoryColor = (name) => getCategoryConfig(name).color;

/* ─── Tooltip adapté au thème courant ─────────────────────────── */
const ThemedTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isDark = document.documentElement.classList.contains('dark-theme') ||
    document.body.classList.contains('dark-theme');
  return (
    <div style={{
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '0.85rem',
      color: isDark ? '#f8fafc' : '#1e293b',
    }}>
      {label && <p style={{ fontWeight: '700', marginBottom: '0.4rem', color: isDark ? '#94a3b8' : '#64748b' }}>{label}</p>}
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
  const isDark = document.documentElement.classList.contains('dark-theme') ||
    document.body.classList.contains('dark-theme');
  return (
    <div style={{
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '0.85rem',
      color: isDark ? '#f8fafc' : '#1e293b',
    }}>
      <p style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill || 'var(--primary)', fontWeight: '600' }}>
        {Number(payload[0].value).toFixed(2)} €
      </p>
    </div>
  );
};

/* ─── Pie Chart ────────────────────────────────────────────────── */
export const CategoryPieChart = ({ data }) => {
  const chartData = Object.entries(data)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, fill: getCategoryColor(name) }));

  if (chartData.length === 0) {
    return (
      <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Aucune dépense ce mois-ci
      </div>
    );
  }

  return (
    <div style={{ height: '280px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ─── Barre cliquable ──────────────────────────────────────────── */
const ClickableBar = (props) => {
  const [hovered, setHovered] = React.useState(false);
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  return (
    <rect
      x={x} y={y} width={width} height={height} fill={fill}
      opacity={hovered ? 1 : 0.82}
      rx={4} ry={4}
      style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    />
  );
};

/* ─── Trend Bar Chart (cliquable) ──────────────────────────────── */
export const MonthlyTrendChart = ({ data }) => {
  const navigate = useNavigate();

  const handleClick = (barData) => {
    if (!barData?.activeLabel) return;
    const entry = data.find(d => d.name === barData.activeLabel);
    if (entry?.monthKey) {
      const [year, month] = entry.monthKey.split('-').map(Number);
      navigate(`/expenses?year=${year}&month=${month - 1}`);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Pas encore de données
      </div>
    );
  }

  return (
    <div style={{ height: '280px', width: '100%' }}>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', textAlign: 'right' }}>
        Cliquez sur un mois pour voir les dépenses
      </p>
      <ResponsiveContainer width="100%" height="93%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} unit="€" width={55} />
          <Tooltip content={<ThemedTooltip />} cursor={{ fill: 'var(--primary-light)', radius: 4 }} />
          <Bar dataKey="foyer" name="Foyer" fill="var(--primary)" shape={<ClickableBar />} barSize={18} />
          <Bar dataKey="perso" name="Perso" fill="#a855f7" shape={<ClickableBar />} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
