import React, { useState, useEffect, useMemo } from 'react';
import { ListPageSkeleton } from '../components/SkeletonLoader';
import { getSettings } from '../services/settings';
import { getMonthlySalaries, updateMonthlySalaries } from '../services/salaries';
import { auth } from '../config/firebase';
import { formatAccountingMonthLabel } from '../utils/monthUtils';
import { Wallet, Check, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { formatEuro } from '../utils/finance';

const Salaries = ({ householdId }) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [salaries, setSalaries] = useState({});
  const [saving, setSaving] = useState(false);
  const { alert } = useConfirm();

  const totalSalary = useMemo(
    () => Object.values(salaries).reduce((a, b) => a + b, 0),
    [salaries]
  );

  useEffect(() => {
    fetchData();
  }, [householdId, currentDate]);

  const fetchData = async () => {
    if (!householdId) return;
    setLoading(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    try {
      const [settingsData, mSalaries] = await Promise.all([
        getSettings(householdId),
        getMonthlySalaries(householdId, year, month)
      ]);
      
      setSettings(settingsData);
      
      const initial = {};
      settingsData.members.forEach(m => {
        initial[m.id] = mSalaries?.salaries?.[m.id] || 0;
      });
      setSalaries(initial);
    } catch (error) {
      console.error("Error loading salaries", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    try {
      await updateMonthlySalaries(householdId, year, month, salaries);
      await alert({ 
        title: 'Sauvegarde réussie', 
        message: 'Vos revenus ont été enregistrés avec succès pour ' + formatAccountingMonthLabel(year, month, settings?.accountStartDay || 1),
        variant: 'success',
        icon: 'save'
      });
    } catch (error) {
      await alert({ 
        title: 'Erreur', 
        message: 'Une erreur est survenue lors de la sauvegarde.',
        variant: 'danger',
        icon: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (delta) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + delta);
    setCurrentDate(next);
  };

  if (loading) return <ListPageSkeleton rows={3} title={false} />;

  return (
    <div className="page-container animate-fade-in">
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>Revenus</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Ajustez vos salaires pour chaque mois</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.8rem 1.25rem' }} onClick={handleSave} disabled={saving}>
          <Check size={18} /> {saving ? '...' : 'Enregistrer'}
        </button>
      </header>

      <div className="month-nav">
        <button className="btn" style={{ padding: '0.5rem', color: 'var(--primary)' }} onClick={() => changeMonth(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="month-nav-title">
          {formatAccountingMonthLabel(currentDate.getFullYear(), currentDate.getMonth(), settings?.accountStartDay || 1).replace(/^\w/, c => c.toUpperCase())}
        </h2>
        <button className="btn" style={{ padding: '0.5rem', color: 'var(--primary)' }} onClick={() => changeMonth(1)}>
          <ChevronRight size={24} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {settings?.members?.map(m => (
          <div key={m.id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="avatar" style={{ borderRadius: '12px', width: '44px', height: '44px' }}>
                {m.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{m.name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenu net mensuel</span>
              </div>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                className="input-field" 
                style={{ fontSize: '1.75rem', fontWeight: '800', paddingRight: '2.5rem', height: '60px' }}
                value={salaries[m.id] || ''} 
                onChange={e => setSalaries({ ...salaries, [m.id]: Number(e.target.value) })}
                placeholder="0"
              />
              <span style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: 'var(--text-muted)', fontSize: '1.25rem' }}>€</span>
            </div>

            {totalSalary > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Part du foyer</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{((salaries[m.id] / totalSalary) * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-solid)' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(salaries[m.id] / totalSalary) * 100}%`, 
                    background: 'var(--primary-gradient)',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card animate-fade-in" style={{ marginTop: '2.5rem', border: '1px solid var(--primary-light)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="icon-badge icon-badge-primary" style={{ padding: '0.85rem', borderRadius: '1rem' }}>
              <TrendingUp size={28} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Revenu total du foyer</p>
              <h3 className="value-large" style={{ color: 'var(--primary)' }}>
                {formatEuro(totalSalary)}
              </h3>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', background: 'var(--bg-subtle)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)' }}>
            {settings?.members?.map(m => (
              <div key={m.id} style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{m.name}</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                   {totalSalary > 0 
                    ? ((salaries[m.id] / totalSalary) * 100).toFixed(0)
                    : 0}%
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Salaries;
