import React from 'react';

const pulse = {
  background: 'linear-gradient(90deg, var(--border-color) 25%, var(--surface-color) 50%, var(--border-color) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  borderRadius: 'var(--radius-sm)',
};

const block = (h, w = '100%', mb = '0') => ({
  ...pulse,
  height: h,
  width: w,
  marginBottom: mb,
  display: 'block',
});

/* ─── Variantes ──────────────────────────────────────────────── */

export const DashboardSkeleton = () => (
  <div className="page-container" style={{ padding: '2rem' }}>
    {/* Titre */}
    <span style={block('2rem', '60%', '2rem')} />

    {/* Widgets row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={block('0.8rem', '50%')} />
          <span style={block('2rem', '70%')} />
          <span style={block('0.7rem', '90%')} />
        </div>
      ))}
    </div>

    {/* Charts row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
      {[1, 2].map(i => (
        <div key={i} className="card" style={{ padding: '1.5rem' }}>
          <span style={block('1rem', '40%', '1rem')} />
          <span style={block('220px')} />
        </div>
      ))}
    </div>
  </div>
);

export const ListPageSkeleton = ({ rows = 4, title = true }) => (
  <div className="page-container" style={{ padding: '2rem' }}>
    {title && <span style={block('2rem', '50%', '1.5rem')} />}

    {/* Month nav */}
    <div className="month-nav" style={{ marginBottom: '1.5rem' }}>
      <span style={block('2rem', '2rem')} />
      <span style={block('1.2rem', '120px')} />
      <span style={block('2rem', '2rem')} />
    </div>

    {/* Liste */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="card" style={{ padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <span style={block('0.9rem', `${55 + (i % 3) * 15}%`)} />
          <span style={block('0.7rem', `${30 + (i % 2) * 20}%`)} />
        </div>
        <span style={block('1.25rem', '70px')} />
      </div>
    ))}
  </div>
);

export const DebtsSkeleton = () => (
  <div className="page-container" style={{ padding: '2rem' }}>
    <span style={block('2rem', '50%', '1.5rem')} />
    <div className="month-nav" style={{ marginBottom: '1.5rem' }}>
      <span style={block('2rem', '2rem')} />
      <span style={block('1.2rem', '120px')} />
      <span style={block('2rem', '2rem')} />
    </div>
    {[1, 2].map(i => (
      <div key={i} className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ ...block('44px', '44px'), borderRadius: '50%' }} />
          <span style={block('1rem', '40%')} />
        </div>
        <span style={block('0.8rem', '100%', '0.5rem')} />
        <span style={block('0.8rem', '80%', '0.5rem')} />
        <span style={block('2.5rem', '100%')} />
      </div>
    ))}
  </div>
);
