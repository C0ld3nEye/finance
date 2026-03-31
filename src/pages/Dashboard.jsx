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

      // 3. Dette & Historique (Calcul différentiel)
      const membersArr = settingsData.members;
      const getShares = (amount, distType, customPerc, refKey) => {
        const s = allSalaries.find(xs => xs.id === refKey);
        const numAmount = Number(amount);
        if (distType === '50_50' || !distType) return { [membersArr[0]?.id]: numAmount/2, [membersArr[1]?.id]: numAmount/2 };
        if (distType === 'prorata') {
          const s1 = s?.salaries?.[membersArr[0]?.id] || 0;
          const s2 = s?.salaries?.[membersArr[1]?.id] || 0;
          if (s1+s2 === 0) return { [membersArr[0]?.id]: numAmount/2, [membersArr[1]?.id]: numAmount/2 };
          return { [membersArr[0]?.id]: numAmount * (s1/(s1+s2)), [membersArr[1]?.id]: numAmount * (s2/(s1+s2)) };
        }
        if (distType === 'custom') {
          const res = {};
          membersArr.forEach(m => res[m.id] = (numAmount * (customPerc?.[m.id] || 0)) / 100);
          return res;
        }
        return {};
      };

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
          const shares = getShares(c.amount, c.distributionType, c.customPercentages, mkey);
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
          const shares = getShares(e.amount, e.distributionType, e.customPercentages, mkey);
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

      // Dette Nette Finale : (Dettes passées + Dettes présentes) - (Règlements déjà faits - Règlements reçus)
      // On simplifie pour avoir : (Somme des shares dues - Somme des shares créancières) - (Virements nets)
      const netDebt = (totalArrears + totalCurrentMonthOwed) - (myPaid - myReceived);

      setData({
        houseExpenses: tHouseExpenses,
        houseCharges: tHouseCharges,
        persoExpenses: tPersoExpenses,
        persoCharges: tPersoCharges,
        totalIncome: tIncome,
        remaining: tIncome - tHouseCharges - tHouseExpenses,
        myMonthlyHouseContribution,
        myPendingDebt: netDebt,
        myPendingArrears: totalArrears,
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
          <p className="value-large" style={{ color: data.remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{data.remaining.toFixed(2)} €</p>
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
            <h3 className="label" style={{ margin: 0 }}>{data.myPendingDebt >= 0 ? 'Ma Dette (Balance)' : 'Mon Crédit (Balance)'}</h3>
            <button onClick={() => navigate('/debts')} className="btn-small">Régler</button>
          </div>
          <p className="value-large" style={{ color: data.myPendingDebt >= 0 ? 'var(--warning)' : 'var(--success)' }}>
            {Math.abs(data.myPendingDebt).toFixed(2)} €
          </p>
          <span style={{ fontSize: '0.85rem', color: data.myPendingArrears > 0 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: data.myPendingArrears > 0 ? '600' : '400' }}>
            {data.myPendingArrears > 0 ? `Incluant ${data.myPendingArrears.toFixed(2)} € d'arriérés` : 'Historique à jour !'}
          </span>
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
