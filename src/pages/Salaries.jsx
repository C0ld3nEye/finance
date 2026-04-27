import React, { useState, useEffect, useMemo } from 'react';
import { getSettings } from '../services/settings';
import { getMonthlySalaries, updateMonthlySalaries } from '../services/salaries';
import { auth } from '../config/firebase';
import { Wallet, Check, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

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
        message: 'Vos revenus ont été enregistrés avec succès pour ' + currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
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

  if (loading) return <div className="page-container" style={{ padding: '2rem' }}><p>Chargement des revenus...</p></div>;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>Revenus Mensuels</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Ajustez vos salaires pour chaque mois</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Check size={18} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </header>

      <div className="month-nav">
        <button className="btn btn-outline" style={{ padding: '0.5rem', border: 'none' }} onClick={() => changeMonth(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="month-nav-title">
          {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h2>
        <button className="btn btn-outline" style={{ padding: '0.5rem', border: 'none' }} onClick={() => changeMonth(1)}>
          <ChevronRight size={24} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {settings?.members?.map(m => (
          <div key={m.id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: '700' }}>
                {m.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>{m.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Revenu net avant impôts</span>
              </div>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                className="input-field" 
                style={{ fontSize: '1.5rem', fontWeight: '700', paddingRight: '2.5rem' }}
                value={salaries[m.id] || ''} 
                onChange={e => setSalaries({ ...salaries, [m.id]: Number(e.target.value) })}
                placeholder="0.00"
              />
              <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-secondary)' }}>€</span>
            </div>

            {totalSalary > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-color)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(salaries[m.id] / totalSalary) * 100}%`, 
                    backgroundColor: 'var(--primary)',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', minWidth: '45px' }}>
                  {((salaries[m.id] / totalSalary) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '2rem', backgroundColor: '#f0fdf4', border: '1px solid #bbfcce', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: '#dcfce7', borderRadius: '50%', color: '#166534' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#166534' }}>Total Foyer</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {totalSalary.toFixed(2)} €
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {settings?.members?.map(m => (
            <div key={m.id} style={{ textAlign: 'center' }}>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{m.name}</div>
               <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)' }}>
                 {totalSalary > 0 
                  ? ((salaries[m.id] / totalSalary) * 100).toFixed(1)
                  : 0}%
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Salaries;
