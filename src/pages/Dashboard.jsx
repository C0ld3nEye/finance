import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExpenses } from '../services/expenses';
import { getAllCharges } from '../services/charges';
import { getSettings } from '../services/settings';
import { getAllMonthlySalaries } from '../services/salaries';
import { getAllSettlements } from '../services/settlements';
import { auth } from '../config/firebase';
import { TrendingUp, TrendingDown, Wallet, ArrowRightLeft, User, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { CategoryPieChart, MonthlyTrendChart, BudgetGauge } from '../components/AnalyticsCharts';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { getCategoryKey } from '../constants/categories';
import { calculateDistribution, getAnnualChargeProgress } from '../utils/finance';

const Dashboard = ({ householdId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('foyer'); // 'foyer' | 'perso'
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

      // Charges annuelles dont l'échéance est ce mois-ci ou le mois prochain
      const upcomingAnnualCharges = currentHouseCharges.filter(c => {
        if (c.frequency !== 'annual') return false;
        const prog = getAnnualChargeProgress(c, currentYear, currentMonth);
        return prog.isDueThisMonth || prog.monthsUntilDue === 1;
      });

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
        trendMap[mStr] = { name: d.toLocaleDateString('fr-FR', { month: 'short' }), monthKey: mStr, foyer: 0, perso: 0 };
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
        upcomingAnnualCharges,
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

  if(loading) return <DashboardSkeleton />;

  const myRestAVivre = data.mySalary - data.myMonthlyHouseContribution - data.persoExpenses - data.persoCharges;
  const totalBudget = data.totalIncome;
  const totalSpent = data.houseCharges + data.houseExpenses;
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  const memberName = settings?.members?.find(m => m.id === auth.currentUser?.uid)?.name || 'Moi';

  // Prévision fin de mois : on extrapole les dépenses à date sur 30 jours
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projectedSpend = dayOfMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : totalSpent;
  const projectedRemaining = data.salairesSaisis ? totalBudget - projectedSpend : null;

  const hasAlerts = data.remaining < 0 || data.myPendingArrears > 0 || !data.salairesSaisis || data.myPendingDebt > 100 || data.upcomingAnnualCharges?.length > 0;

  return (
    <div className="page-container animate-fade-in">

      {/* ── Header ── */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '0.2rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{monthLabel}</p>
        </div>
        {hasAlerts && (
          <button onClick={() => document.getElementById('alerts-section').scrollIntoView({ behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--danger-light)', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: '600' }}>
            <AlertTriangle size={14} /> {(data.upcomingAnnualCharges?.length || 0) + (data.myPendingArrears > 0 ? 1 : 0) + (!data.salairesSaisis ? 1 : 0)} alerte(s)
          </button>
        )}
      </header>

      {/* ── Sélecteur de vue ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setView('foyer')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s ease', background: view === 'foyer' ? 'var(--primary)' : 'var(--surface-color)', color: view === 'foyer' ? 'white' : 'var(--text-secondary)' }}>
          <Wallet size={15} /> Foyer
        </button>
        <button onClick={() => setView('perso')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s ease', background: view === 'perso' ? '#6366f1' : 'var(--surface-color)', color: view === 'perso' ? 'white' : 'var(--text-secondary)' }}>
          <User size={15} /> {memberName}
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          VUE FOYER
      ══════════════════════════════════════════════ */}
      {view === 'foyer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Row 1 : Reste foyer + Prévision */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="label">Reste foyer</span>
              {data.remaining === null
                ? <span className="error-text" style={{ fontSize: '0.85rem' }}>⚠ Saisissez les salaires du mois</span>
                : <p className="value-large" style={{ color: data.remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{data.remaining.toFixed(2)} €</p>
              }
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>sur {data.totalIncome.toFixed(0)} € de revenus</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="label">Prévision fin de mois</span>
              {projectedRemaining === null
                ? <span className="error-text" style={{ fontSize: '0.85rem' }}>⚠ Salaires manquants</span>
                : <p className="value-large" style={{ color: projectedRemaining >= 0 ? 'var(--warning)' : 'var(--danger)' }}>{projectedRemaining.toFixed(2)} €</p>
              }
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>extrapolé sur {daysInMonth} jours (jour {dayOfMonth})</span>
            </div>
          </div>

          {/* Row 2 : Jauge budget + Détail */}
          <div className="card">
            <h3 className="label" style={{ marginBottom: '1rem' }}>Budget consommé ce mois</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <BudgetGauge spent={totalSpent} total={totalBudget} label="consommé" />
              <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Charges</span>
                    <span style={{ fontWeight: '600' }}>{data.houseCharges.toFixed(2)} €</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: totalBudget > 0 ? `${Math.min((data.houseCharges / totalBudget) * 100, 100)}%` : '0%', background: 'var(--primary)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dépenses</span>
                    <span style={{ fontWeight: '600' }}>{data.houseExpenses.toFixed(2)} €</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: totalBudget > 0 ? `${Math.min((data.houseExpenses / totalBudget) * 100, 100)}%` : '0%', background: '#a855f7', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Total</span>
                    <span style={{ fontWeight: '700' }}>{totalSpent.toFixed(2)} € / {totalBudget.toFixed(2)} €</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: totalBudget > 0 ? `${Math.min((totalSpent / totalBudget) * 100, 100)}%` : '0%', background: 'var(--success)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3 : Donut catégories */}
          <div className="card">
            <h3 className="label" style={{ marginBottom: '1rem' }}>Répartition par catégorie</h3>
            <CategoryPieChart data={data.categoryData || {}} />
          </div>

          {/* Row 4 : Comparatif mois */}
          <div className="card">
            <h3 className="label" style={{ marginBottom: '0.5rem' }}>Foyer vs Perso — 6 derniers mois</h3>
            <MonthlyTrendChart data={data.trendData || []} />
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════
          VUE PERSO
      ══════════════════════════════════════════════ */}
      {view === 'perso' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Balance — widget principal mis en avant */}
          <div className="card" style={{ borderLeft: `4px solid ${data.myPendingDebt > 0 ? 'var(--warning)' : data.myPendingDebt < 0 ? 'var(--success)' : 'var(--primary)'}`, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span className="label">Ma balance foyer</span>
              <button onClick={() => navigate('/debts')} className="btn-small">Régler →</button>
            </div>
            <p style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px', color: data.myPendingDebt > 0 ? 'var(--warning)' : data.myPendingDebt < 0 ? 'var(--success)' : 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              {data.myPendingDebt > 0 ? '−' : data.myPendingDebt < 0 ? '+' : ''}{Math.abs(data.myPendingDebt).toFixed(2)} €
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {data.myPendingDebt > 0 ? 'Vous devez reverser au foyer' : data.myPendingDebt < 0 ? 'Le foyer vous doit de l\'argent' : 'Tout est à jour !'}
            </p>
            {data.myPendingArrears > 0 && (
              <div className="alert-banner alert-banner-danger" style={{ marginTop: '0.75rem' }}>
                <TrendingDown size={14} />
                <span style={{ fontSize: '0.82rem' }}>Dont {data.myPendingArrears.toFixed(2)} € d'arriérés non soldés</span>
              </div>
            )}
          </div>

          {/* Row : Salaire + Reste à vivre */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="label">Mon salaire</span>
              <p className="value-large" style={{ color: '#6366f1' }}>{data.mySalary.toFixed(2)} €</p>
              {data.mySalary === 0 && <span className="error-text" style={{ fontSize: '0.8rem' }}>⚠ Non saisi ce mois</span>}
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="label">Mon reste à vivre</span>
              <p className="value-large" style={{ color: myRestAVivre >= 0 ? 'var(--success)' : 'var(--danger)' }}>{myRestAVivre.toFixed(2)} €</p>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>après toutes mes parts</span>
            </div>
          </div>

          {/* Row : Ma part foyer + Mes dépenses perso */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="label">Ma part du foyer</span>
              <p className="value-large" style={{ color: '#a855f7' }}>{data.myMonthlyHouseContribution.toFixed(2)} €</p>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>quote-part charges + dépenses communes</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="label">Mes dépenses perso</span>
              <p className="value-large" style={{ color: 'var(--danger)' }}>{(data.persoExpenses + data.persoCharges).toFixed(2)} €</p>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{data.persoExpenses.toFixed(0)} € dépenses + {data.persoCharges.toFixed(0)} € charges</span>
            </div>
          </div>

          {/* Jauge perso */}
          <div className="card">
            <h3 className="label" style={{ marginBottom: '1rem' }}>Mon budget consommé</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <BudgetGauge spent={data.myMonthlyHouseContribution + data.persoExpenses + data.persoCharges} total={data.mySalary} label="de mon salaire" />
              <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'Part foyer', val: data.myMonthlyHouseContribution, color: '#6366f1' },
                  { label: 'Dépenses perso', val: data.persoExpenses, color: '#a855f7' },
                  { label: 'Charges perso', val: data.persoCharges, color: 'var(--warning)' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: '600' }}>{val.toFixed(2)} €</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: data.mySalary > 0 ? `${Math.min((val / data.mySalary) * 100, 100)}%` : '0%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Alertes (communes aux deux vues) ── */}
      {hasAlerts && (
        <div id="alerts-section" className="card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> Points d'attention
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {!data.salairesSaisis && (
              <div className="alert-banner alert-banner-info">
                <span style={{ fontSize: '1rem' }}>💡</span>
                <span>Salaires du mois non saisis — les calculs sont incomplets. <button onClick={() => navigate('/salaries')} className="btn-small" style={{ marginLeft: '0.5rem' }}>Saisir</button></span>
              </div>
            )}
            {data.remaining !== null && data.remaining < 0 && (
              <div className="alert-banner alert-banner-danger">
                <span>⚠️</span>
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Budget foyer dépassé de {Math.abs(data.remaining).toFixed(2)} € ce mois-ci.</span>
              </div>
            )}
            {data.myPendingArrears > 0 && (
              <div className="alert-banner alert-banner-danger">
                <span>🔴</span>
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{data.myPendingArrears.toFixed(2)} € d'arriérés non soldés. <button onClick={() => navigate('/debts')} className="btn-small" style={{ marginLeft: '0.5rem' }}>Voir</button></span>
              </div>
            )}
            {data.myPendingDebt > 100 && data.myPendingArrears === 0 && (
              <div className="alert-banner alert-banner-warning">
                <span>🟡</span>
                <span>{data.myPendingDebt.toFixed(2)} € à reverser au foyer ce mois-ci.</span>
              </div>
            )}
            {data.upcomingAnnualCharges?.map(c => {
              const prog = getAnnualChargeProgress(c, new Date().getFullYear(), new Date().getMonth());
              return (
                <div key={c.id} className={`alert-banner ${prog.isDueThisMonth ? 'alert-banner-danger' : 'alert-banner-warning'}`}>
                  <span>{prog.isDueThisMonth ? '📅' : '⚡'}</span>
                  <span>
                    <strong>{c.name}</strong> — {prog.isDueThisMonth ? 'échéance ce mois !' : 'échéance le mois prochain'} ({c.annualAmount} €).{' '}
                    Provision : {prog.provisioned.toFixed(0)} / {prog.total.toFixed(0)} €
                    {prog.remaining > 0 && <span style={{ color: prog.isDueThisMonth ? 'var(--danger)' : 'var(--warning)', fontWeight: '700' }}> — manque {prog.remaining.toFixed(2)} €</span>}
                    {prog.remaining === 0 && <span style={{ color: 'var(--success)', fontWeight: '700' }}> ✓ Provision complète</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
