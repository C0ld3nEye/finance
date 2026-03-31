import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { CATEGORY_CONFIG, getCategoryConfig } from '../constants/categories';

const getCategoryColor = (name) => getCategoryConfig(name).color;

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '0.75rem', 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }}>
        <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{payload[0].name}</p>
        <p style={{ color: 'var(--primary)' }}>{payload[0].value.toFixed(2)} €</p>
      </div>
    );
  }
  return null;
};

export const CategoryPieChart = ({ data }) => {
  const chartData = Object.entries(data)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]) // Sort by amount descending
    .map(([name, value]) => ({ name, value }));

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MonthlyTrendChart = ({ data }) => {
  return (
    <div style={{ height: '300px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            unit="€"
          />
          <Tooltip 
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            content={<CustomTooltip />}
          />
          <Bar 
            dataKey="foyer" 
            name="Foyer" 
            fill="var(--primary)" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
          <Bar 
            dataKey="perso" 
            name="Perso" 
            fill="#a855f7" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
