import React, { useState, useEffect } from 'react';
import { getExpensesByMonth } from '../services/expenses';
import { getCharges } from '../services/charges';
import { getSettings } from '../services/settings';
import { auth } from '../config/firebase';
import { PieChart, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalExpenses: 0,
    totalCharges: 0,
    totalIncome: 0,
    remaining: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    try {
      const now = new Date();
      const [expenses, charges, settings] = await Promise.all([
        getExpensesByMonth(uid, now.getFullYear(), now.getMonth()),
        getCharges(uid),
        getSettings(uid)
      ]);

      const tExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      const tCharges = charges.reduce((acc, curr) => acc + curr.amount, 0);
      const tIncome = settings.members.reduce((acc, curr) => acc + curr.salary, 0);

      setData({
        totalExpenses: tExpenses,
        totalCharges: tCharges,
        totalIncome: tIncome,
        remaining: tIncome - tCharges - tExpenses
      });
    } catch (error) {
      console.error("Dashboard error", error);
    } finally {
      setLoading(false);
    }
  };

  if(loading) return <div className="page-container" style={{ padding: '2rem' }}><p>Chargement du dashboard...</p></div>;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Aperçu de vos finances pour {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</p>
      </header>
      
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Revenus du Foyer</h3>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%' }}><Wallet size={20} /></div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>{data.totalIncome.toFixed(2)} €</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Total Charges Fixes</h3>
            <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', color: 'var(--warning)', borderRadius: '50%' }}><PieChart size={20} /></div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--warning)' }}>{data.totalCharges.toFixed(2)} €</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Dépenses Courantes</h3>
            <div style={{ padding: '0.5rem', backgroundColor: '#fee2e2', color: 'var(--danger)', borderRadius: '50%' }}><TrendingDown size={20} /></div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--danger)' }}>{data.totalExpenses.toFixed(2)} €</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Reste à Vivre Actuel</h3>
            <div style={{ padding: '0.5rem', backgroundColor: '#d1fae5', color: 'var(--success)', borderRadius: '50%' }}><TrendingUp size={20} /></div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: data.remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{data.remaining.toFixed(2)} €</p>
        </div>
      </div>
      
      <div className="card animate-fade-in">
         <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>État des Finances</h2>
         <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '1.1rem' }}>
           Vous avez un reste à vivre de <strong style={{color: 'var(--text-primary)'}}>{data.remaining.toFixed(2)} €</strong> pour l'instant ce mois-ci, après soustraction de toutes vos charges fixes théoriques et de vos dépenses courantes déjà saisies enregistrées. 
           {data.remaining < 0 && <span style={{color: 'var(--danger)', fontWeight: '600'}}> Attention, votre budget du mois a été dépassé !</span>}
         </p>
      </div>
    </div>
  );
};

export default Dashboard;
