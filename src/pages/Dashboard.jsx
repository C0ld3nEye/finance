import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExpenses } from '../services/expenses';
import { getAllCharges } from '../services/charges';
import { getSettings } from '../services/settings';
import { getAllMonthlySalaries } from '../services/salaries';
import { getAllSettlements } from '../services/settlements';
import { auth } from '../config/firebase';
import { PieChart as ChartIcon, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, User, Lock } from 'lucide-react';
import { CategoryPieChart, MonthlyTrendChart } from '../components/AnalyticsCharts';
import { getCategoryKey } from '../constants/categories';
import { calculateDistribution } from '../utils/finance';

const Dashboard = ({ householdId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [monthlySalaries, setMonthlySalaries] = useState(null);
  const [data, setData] = useState({
    totalExpenses: 0,
    totalCharges: 0,
    totalIncome: 0,
    remaining: 0
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  useEffect(() => {
    fetchData();
  }, [householdId]);

  const fetchData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId) return;
    
    try {
      const [allExpenses, allCharges, settingsData, allSalaries, allSettlements] = await Promise.all([
        getAllExpenses(householdId, uid),
        getAllCharges(householdId, uid),
        getSettings(householdId),
        getAllMonthlySalaries(householdId),
        getAllSettlements(householdId)
      ]);

      setSettings(settingsData);
      const currentMonthKey = `${currentYear}-${(currentMonth+1).toString().padStart(2, '0')}`;
      const mSal = allSalaries.find(s => s.id === currentMonthKey);
      setMonthlySalaries(mSal);

      const getItemVisibility = (item) => {
        if (item.visibility === 'shared' || item.visibility === 'perso') return item.visibility;
        // Fallback pour les anciennes données par type de compte
        const acc = settingsData.accounts.find(a => a.id === item.accountId);
        if (acc?.visibility === 'shared') return 'shared';
        if (acc?.ownerId === uid) return uid;
        if (acc?.ownerId) return acc.ownerId;
        return 'shared'; // Défaut
      };

      // 1. Synthèse du Foyer (Mois en cours)
      const currentHouseExpenses = allExpenses.filter(e => {
        const d = new Date(e.date || e.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth && getItemVisibility(e) === 'shared';
      });
      const currentHouseCharges = allCharges.filter(c => {
        const from = (c.validFrom || '').slice(0, 7) || '0000-01';
        const to = (c.validTo || '').slice(0, 7) || '9999-12';
        return currentMonthKey >= from && currentMonthKey <= to && getItemVisibility(c) === 'shared';
      });

      // 2. Synthèse Perso (Mois en cours)
      const currentPersoExpenses = allExpenses.filter(e => {
        const d = new Date(e.date || e.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth && getItemVisibility(e) === uid;
      });
      const currentPersoCharges = allCharges.filter(c => {
        const from = (c.validFrom || '').slice(0, 7) || '0000-01';
        const to = (c.validTo || '').slice(0, 7) || '9999-12';
        return currentMonthKey >= from && currentMonthKey <= to && getItemVisibility(c) === uid;
      });

      const tHouseExpenses = currentHouseExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      const tHouseCharges = currentHouseCharges.reduce((acc, curr) => acc + curr.amount, 0);
      const tPersoExpenses = currentPersoExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      const tPersoCharges = currentPersoCharges.reduce((acc, curr) => acc + curr.amount, 0);
      
      const tIncome = mSal?.salaries ? Object.values(mSal.salaries).reduce((a, b) => a + b, 0) : 0;
      const salairesSaisis = !!mSal?.salaries && Object.values(mSal.salaries).some(v => v > 0);

      // 3. Dette & Historique (Calcul différentiel)
      const membersArr = settingsData.members;
      // Utilise calculateDistribution centralisé (utils/finance.js)
      const getShares = (amount, distType, customPerc, refKey, customAmts = {}) =>
        calculateDistribution(amount, distType || '50_50', membersArr, {}, customPerc, customAmts, allSalaries, new Date(refKey + '-15'));

      const categoryTotals = {};
      const trendMap = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const mStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        trendMap[mStr] = { name: d.toLocaleDateString('fr-FR', { month: 'short' }), foyer: 0, perso: 0 };
      }

      let totalArrears = 0; // Dette passée (Expenses uniquement)
      let totalCurrentMonthOwed = 0; // Ce que je dois ce mois-ci (Expenses + Charges)
      let myMonthlyHouseContribution = 0; // Ma part totale théorique ce mois-ci

      // Loop pour Trend et Dette
      Object.keys(trendMap).forEach(mkey => {
        const isCurrent = (mkey === currentMonthKey);
        
        // Charges dans ce mois
        allCharges.filter(c => {
          const from = (c.validFrom || '').slice(0, 7) || '0000-01';
          const to = (c.validTo || '').slice(0, 7) || '9999-12';
          return mkey >= from && mkey <= to;
        }).forEach(c => {
          const shares = getShares(c.amount, c.distributionType, c.customPercentages, mkey, c.customAmounts);
          const share = shares[uid] || 0;
          const vis = getItemVisibility(c);
          const account = settingsData.accounts.find(a => a.id === c.accountId);

          if (vis === 'shared') {
            trendMap[mkey].foyer += Number(c.amount);
            
            // Gestion de la Dette
            if (account?.visibility === 'shared' || (account?.ownerId && account.ownerId !== uid)) {
              if (isCurrent) totalCurrentMonthOwed += share;
              else totalArrears += share;
            } else if (account?.ownerId === uid) {
              const partnerShare = Number(c.amount) - share;
              if (isCurrent) totalCurrentMonthOwed -= partnerShare;
              else totalArrears -= partnerShare;
            }

            if (isCurrent) {
              myMonthlyHouseContribution += share;
              const catKey = getCategoryKey(c.category);
              categoryTotals[catKey] = (categoryTotals[catKey] || 0) + Number(c.amount);
            }
          } else if (vis === uid) {
            trendMap[mkey].perso += Number(c.amount);
          }
        });

        // Expenses dans ce mois
        allExpenses.filter(e => {
          const d = new Date(e.date || e.createdAt);
          const eKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
          return eKey === mkey;
        }).forEach(e => {
          const shares = getShares(e.amount, e.distributionType, e.customPercentages, mkey, e.customAmounts);
          const share = shares[uid] || 0;
          const vis = getItemVisibility(e);
          const account = settingsData.accounts.find(a => a.id === e.accountId);

          if (vis === 'shared') {
            trendMap[mkey].foyer += Number(e.amount);

            // Gestion de la Dette
            if (account?.visibility === 'shared' || (account?.ownerId && account.ownerId !== uid)) {
              // Payé par le foyer ou l'autre -> Je dois ma part
              if (isCurrent) totalCurrentMonthOwed += share;
              else totalArrears += share;
            } else if (account?.ownerId === uid) {
              // Payé par moi -> L'autre me doit sa part (créance)
              const partnerShare = Number(e.amount) - share;
              if (isCurrent) totalCurrentMonthOwed -= partnerShare;
              else totalArrears -= partnerShare;
            }

            if (isCurrent) {
              myMonthlyHouseContribution += share;
              const catKey = getCategoryKey(e.category);
              categoryTotals[catKey] = (categoryTotals[catKey] || 0) + Number(e.amount);
            }
          } else if (vis === uid) {
            trendMap[mkey].perso += Number(e.amount);
          }
        });
      });

      // Règlements
      const myPaid = allSettlements
        .filter(s => {
           const sKey = `${s.year}-${(s.month+1).toString().padStart(2, '0')}`;
           return sKey <= currentMonthKey && s.fromId === uid;
        })
        .reduce((acc, curr) => acc + curr.amount, 0);

      // Les versements reçus (Settlements où je suis TO)
      const myReceived = allSettlements
        .filter(s => {
           const sKey = `${s.year}-${(s.month+1).toString().padStart(2, '0')}`;
           return sKey <= currentMonthKey && s.toId === uid;
        })
        .reduce((acc, curr) => acc + curr.amount, 0);

      const netPaid = myPaid - myReceived;

      // FIFO : les règlements couvrent d'abord les arriérés passés, puis le mois courant
      const remainingArrears = Math.max(0, totalArrears - netPaid);

      // Dette nette finale
      const netDebt = (totalArrears + totalCurrentMonthOwed) - netPaid;

      setData({
        houseExpenses: tHouseExpenses,
        houseCharges: tHouseCharges,
        persoExpenses: tPersoExpenses,
        persoCharges: tPersoCharges,
        totalIncome: tIncome,
        salairesSaisis,
        remaining: salairesSaisis ? tIncome - tHouseCharges - tHouseExpenses : null,
        myMonthlyHouseContribution,
        myPendingDebt: netDebt,
        myPendingArrears: remainingArrears,
        mySalary: mSal?.salaries?.[uid] || 0,
        categoryData: categoryTotals,
        trendData: Object.values(trendMap)
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
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px', marginBottom: '0.5rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Aperçu de vos finances pour {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</p>
      </header>
      
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary)' }}>Budget du Foyer</h2>
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Revenus Communs</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={() => navigate('/salaries')} className="btn-small">Détails</button>
              <div className="icon-badge-primary"><Wallet size={20} /></div>
            </div>
          </div>
          <p className="value-large">{data.totalIncome.toFixed(2)} €</p>
          {data.totalIncome === 0 && <span className="error-text">⚠ Non saisis</span>}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Charges Foyer</h3>
            <div className="icon-badge-warning"><ChartIcon size={20} /></div>
          </div>
          <p className="value-large" style={{ color: 'var(--warning)' }}>{data.houseCharges.toFixed(2)} €</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Dépenses Foyer</h3>
            <div className="icon-badge-danger"><TrendingDown size={20} /></div>
          </div>
          <p className="value-large" style={{ color: 'var(--danger)' }}>{data.houseExpenses.toFixed(2)} €</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="label" style={{ margin: 0 }}>Reste Foyer</h3>
            <div className="icon-badge-success"><TrendingUp size={20} /></div>
          </div>
          {data.remaining === null ? (
            <span className="error-text">⚠ Saisissez les salaires du mois pour calculer le reste</span>
          ) : (
            <p className="value-large" style={{ color: data.remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{data.remaining.toFixed(2)} €</p>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#6366f1' }}>Mes Finances Perso</h2>
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 className="label" style={{ margin: 0 }}>Mon Salaire</h3>
            <div className="icon-badge-indigo"><User size={20} /></div>
          </div>
          <p className="value-large" style={{ color: '#6366f1' }}>{data.mySalary.toFixed(2)} €</p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 className="label" style={{ margin: 0 }}>Ma Part du Foyer (Mois)</h3>
            <div className="icon-badge-purple"><ChartIcon size={20} /></div>
          </div>
          <p className="value-large" style={{ color: '#a855f7' }}>{data.myMonthlyHouseContribution.toFixed(2)} €</p>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Votre quote-part des charges communes</span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 className="label" style={{ margin: 0 }}>Balance Foyer</h3>
            <button onClick={() => navigate('/debts')} className="btn-small">Régler</button>
          </div>
          <p className="value-large" style={{ color: data.myPendingDebt > 0 ? 'var(--warning)' : data.myPendingDebt < 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
            {data.myPendingDebt > 0 ? '−' : data.myPendingDebt < 0 ? '+' : ''}{Math.abs(data.myPendingDebt).toFixed(2)} €
          </p>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {data.myPendingDebt > 0 ? 'Vous devez reverser au foyer' : data.myPendingDebt < 0 ? 'Le foyer vous doit' : 'Tout est à jour !'}
          </span>
          {data.myPendingArrears > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--danger)', fontWeight: '600' }}>
              Dont {data.myPendingArrears.toFixed(2)} € d'arriérés
            </span>
          )}
        </div>
        
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 className="label" style={{ margin: 0 }}>Mon Reste à Vivre</h3>
            <div className="icon-badge-sky"><TrendingUp size={20} /></div>
          </div>
          <p className="value-large" style={{ color: '#0ea5e9' }}>
            {(data.mySalary - data.myMonthlyHouseContribution - data.persoExpenses - data.persoCharges).toFixed(2)} €
          </p>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Après retrait de vos parts de ce mois</span>
        </div>
      </div>
      
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>Analyse des Dépenses</h2>
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Répartition du foyer (ce mois)</h3>
          <CategoryPieChart data={data.categoryData || {}} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Évolution sur 6 mois (Total)</h3>
          <MonthlyTrendChart data={data.trendData || []} />
        </div>
      </div>

      {(data.remaining < 0 || data.myPendingArrears > 0 || !data.salairesSaisis || data.myPendingDebt > 100) && (
        <div className="card animate-fade-in">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem' }}>Points d'attention</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {!data.salairesSaisis && (
              <div className="alert-banner alert-banner-info">
                <span style={{ fontSize: '1rem' }}>💡</span>
                <span>Les salaires de ce mois ne sont pas encore saisis — le reste foyer ne peut pas être calculé. <button onClick={() => navigate('/salaries')} className="btn-small" style={{ marginLeft: '0.5rem' }}>Saisir</button></span>
              </div>
            )}
            {data.remaining !== null && data.remaining < 0 && (
              <div className="alert-banner alert-banner-danger">
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Budget foyer dépassé de {Math.abs(data.remaining).toFixed(2)} € ce mois-ci.</span>
              </div>
            )}
            {data.myPendingArrears > 0 && (
              <div className="alert-banner alert-banner-danger">
                <span style={{ fontSize: '1rem' }}>🔴</span>
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{data.myPendingArrears.toFixed(2)} € d'arriérés non soldés sur des mois précédents. <button onClick={() => navigate('/debts')} className="btn-small" style={{ marginLeft: '0.5rem' }}>Voir</button></span>
              </div>
            )}
            {data.myPendingDebt > 100 && data.myPendingArrears === 0 && (
              <div className="alert-banner alert-banner-warning">
                <span style={{ fontSize: '1rem' }}>🟡</span>
                <span>Vous avez {data.myPendingDebt.toFixed(2)} € à reverser au foyer ce mois-ci.</span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
  );
};

export default Dashboard;
