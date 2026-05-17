import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../config/pocketbase';
import { useHouseholdData } from '../hooks/useHouseholdData';
import { isChargeVisibleTo } from '../services/charges';
import { isExpenseVisibleTo } from '../services/expenses';
import { getAccountingMonth, isInAccountingMonth, isChargeActiveInMonth, formatAccountingMonthLabel } from '../utils/monthUtils';
import { calculateDistribution, getAnnualChargeProgress, formatEuro } from '../utils/finance';
import { findSalariesForMonth } from '../services/salaries';
import {
  TrendingDown, Wallet, User, AlertTriangle, PiggyBank,
  Car, Home, Plane, Wrench, GraduationCap, Baby, Laptop, Gift, MoreHorizontal, Check
} from 'lucide-react';
import { CategoryPieChart, MonthlyTrendChart, BudgetGauge } from '../components/AnalyticsCharts';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { getCategoryKey } from '../constants/categories';
import { calculateHouseholdDebts } from '../utils/debtUtils';

const PROJECT_ICONS = {
  Vacances: Plane, Voiture: Car, Logement: Home, Travaux: Wrench,
  Études: GraduationCap, Bébé: Baby, Informatique: Laptop, Cadeau: Gift, Autre: MoreHorizontal,
};

const Dashboard = ({ householdId }) => {
  const navigate = useNavigate();
  const [view, setView] = useState('foyer');
  const uid = pb.authStore.model?.id;

  const { charges, expenses, settlements, savings, projects, salaries, settings, loading } = useHouseholdData(householdId);

  const startDay = settings?.accountStartDay || 1;
  const now = new Date();
  const { year: currentYear, month: currentMonth } = getAccountingMonth(now, startDay);
  const currentMonthKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`;

  const computed = useMemo(() => {
    if (!settings || !uid) return null;

    const members = settings.members || [];
    const accounts = settings.accounts || [];

    const getItemVisibility = (item) => {
      if (item.visibility === 'shared') return 'shared';
      if (item.visibility === uid) return uid;
      if (item.userId === uid) return uid;
      const acc = accounts.find(a => a.id === item.accountId);
      if (acc?.visibility === 'shared') return 'shared';
      if (acc?.ownerId === uid) return uid;
      if (acc?.ownerId) return acc.ownerId;
      return 'shared';
    };

    const calcShares = (item, refDate) =>
      calculateDistribution(
        item.amount, item.distributionType || '50_50', members, {},
        item.customPercentages, item.customAmounts, salaries, refDate
      );

    // Charges du mois courant
    const monthCharges = charges.filter(c => isChargeActiveInMonth(c, currentYear, currentMonth));
    const houseCharges = monthCharges.filter(c => isChargeVisibleTo(c, uid) && getItemVisibility(c) === 'shared');
    const persoCharges = monthCharges.filter(c => isChargeVisibleTo(c, uid) && getItemVisibility(c) === uid);

    // Dépenses du mois courant
    const monthExpenses = expenses.filter(e => isExpenseVisibleTo(e, uid) && isInAccountingMonth(e.date || e.createdAt, currentYear, currentMonth, startDay));
    const houseExpenses = monthExpenses.filter(e => getItemVisibility(e) === 'shared');
    const persoExpenses = monthExpenses.filter(e => getItemVisibility(e) === uid);

    const tHouseCharges  = houseCharges.reduce((a, c) => a + Number(c.amount), 0);
    const tHouseExpenses = houseExpenses.reduce((a, e) => a + Number(e.amount), 0);
    const tPersoCharges  = persoCharges.reduce((a, c) => a + Number(c.amount), 0);
    const tPersoExpenses = persoExpenses.reduce((a, e) => a + Number(e.amount), 0);

    // Épargne
    const monthlySavingsShared = savings.filter(s => s.visibility === 'shared').reduce((a, s) => a + Number(s.amount), 0);
    const monthlySavingsPerso  = savings.filter(s => s.visibility === 'perso').reduce((a, s) => a + Number(s.amount), 0);

    // Salaires du mois
    const mSal = findSalariesForMonth(salaries, currentYear, currentMonth);
    const totalIncome = mSal?.salaries ? Object.values(mSal.salaries).reduce((a, b) => a + b, 0) : 0;
    const mySalary = mSal?.salaries?.[uid] || 0;
    const salairesSaisis = totalIncome > 0;

    // Ma part des charges foyer
    const refDate = new Date(currentYear, currentMonth, 15);
    let myHouseContribCharges = 0;
    houseCharges.forEach(c => { myHouseContribCharges += calcShares(c, refDate)[uid] || 0; });
    let myHouseContribExpenses = 0;
    houseExpenses.forEach(e => { myHouseContribExpenses += calcShares(e, refDate)[uid] || 0; });

    const myHouseContribution = myHouseContribCharges + myHouseContribExpenses;

    // Catégories
    const categoryData = {};
    houseCharges.forEach(c => {
      const k = getCategoryKey(c.category);
      categoryData[k] = (categoryData[k] || 0) + Number(c.amount);
    });
    houseExpenses.forEach(e => {
      const k = getCategoryKey(e.category);
      categoryData[k] = (categoryData[k] || 0) + Number(e.amount);
    });

    // Tendance 6 mois
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const mCharges = charges.filter(c => isChargeVisibleTo(c, uid) && isChargeActiveInMonth(c, y, m));
      const mExpenses = expenses.filter(e => isExpenseVisibleTo(e, uid) && isInAccountingMonth(e.date || e.createdAt, y, m, startDay));
      trendData.push({
        name: label,
        foyer: mCharges.filter(c => getItemVisibility(c) === 'shared').reduce((a, c) => a + Number(c.amount), 0)
             + mExpenses.filter(e => getItemVisibility(e) === 'shared').reduce((a, e) => a + Number(e.amount), 0),
        perso: mCharges.filter(c => getItemVisibility(c) === uid).reduce((a, c) => a + Number(c.amount), 0)
             + mExpenses.filter(e => getItemVisibility(e) === uid).reduce((a, e) => a + Number(e.amount), 0),
      });
    }

    // Alertes charges annuelles
    const upcomingAnnualCharges = houseCharges.filter(c => {
      if (c.frequency !== 'annual') return false;
      const prog = getAnnualChargeProgress(c, currentYear, currentMonth);
      return prog.isDueThisMonth || prog.monthsUntilDue === 1;
    });

    // Calcul de la balance cumulée (Dettes)
    const debtsData = calculateHouseholdDebts(members, accounts, expenses, charges, settlements, salaries, startDay, currentYear, currentMonth);
    let totalArrears = 0;
    let totalCurrent = 0;

    if (debtsData) {
      // Dettes de l'utilisateur vers le foyer ou partenaires
      const calcRem = (type, fromId, toId, arrears, current) => {
        const pastPaid = debtsData.filteredSettlements
          .filter(s => s.type === type && s.fromId === fromId && s.toId === toId && !(s.year === currentYear && s.month === currentMonth))
          .reduce((a, s) => a + s.amount, 0);
        const currentPaid = debtsData.monthSettlements
          .filter(s => s.type === type && s.fromId === fromId && s.toId === toId)
          .reduce((a, s) => a + s.amount, 0);
        const arrearsAfterPast = Math.max(0, arrears - pastPaid);
        const remArrears = Math.max(0, arrearsAfterPast - currentPaid);
        const excessForCurrent = Math.max(0, currentPaid - arrearsAfterPast);
        const remCurrent = Math.max(0, current - excessForCurrent);
        return { remArrears, remCurrent };
      };

      Object.keys(debtsData.toCommon[uid] || {}).forEach(accId => {
        const { remArrears, remCurrent } = calcRem('common', uid, accId, debtsData.toCommon[uid][accId].arrears, debtsData.toCommon[uid][accId].current);
        totalArrears += remArrears;
        totalCurrent += remCurrent;
      });
      Object.keys(debtsData.toPartners[uid] || {}).forEach(pId => {
        const { remArrears, remCurrent } = calcRem('partner', uid, pId, debtsData.toPartners[uid][pId].arrears, debtsData.toPartners[uid][pId].current);
        totalArrears += remArrears;
        totalCurrent += remCurrent;
      });

      // Créances (ce que les autres doivent à l'utilisateur)
      members.forEach(m => {
        if (m.id === uid) return;
        const rawP = debtsData.toPartners[m.id]?.[uid];
        if (rawP) {
          const { remArrears, remCurrent } = calcRem('partner', m.id, uid, rawP.arrears, rawP.current);
          totalArrears -= remArrears;
          totalCurrent -= remCurrent;
        }
      });
    }
    const remaining = salairesSaisis ? totalIncome - tHouseCharges - tHouseExpenses - monthlySavingsShared : null;
    const myRestAVivre = mySalary - myHouseContribution - tPersoExpenses - tPersoCharges - monthlySavingsPerso;

    return {
      tHouseCharges, tHouseExpenses, tPersoCharges, tPersoExpenses,
      totalIncome, mySalary, salairesSaisis,
      monthlySavingsShared, monthlySavingsPerso,
      myHouseContribution, myHouseContribExpenses, myHouseContribCharges,
      remaining, myRestAVivre,
      categoryData, trendData, upcomingAnnualCharges,
      myPendingDebt: totalArrears + totalCurrent,
      myPendingArrears: totalArrears,
    };
  }, [charges, expenses, settlements, savings, salaries, settings, uid, currentYear, currentMonth, startDay]);

  if (loading) return <DashboardSkeleton />;
  if (!computed) {
    return (
      <div className="page-container animate-fade-in" style={{ textAlign: 'center', marginTop: '10vh' }}>
        <AlertTriangle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Erreur d'initialisation</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Le tableau de bord n'a pas pu se charger car les paramètres du foyer n'ont pas été trouvés.
        </p>
        <div className="card" style={{ textAlign: 'left', background: 'var(--bg-subtle)' }}>
          <p><strong>Diagnostic :</strong></p>
          <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify({ 
              hasSettings: !!settings, 
              hasUid: !!uid, 
              householdId 
            }, null, 2)}
          </pre>
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: '2rem' }}>
          Rafraîchir la page
        </button>
      </div>
    );
  }

  const {
    tHouseCharges, tHouseExpenses, tPersoCharges, tPersoExpenses,
    totalIncome, mySalary, salairesSaisis,
    monthlySavingsShared, monthlySavingsPerso,
    myHouseContribution, myHouseContribExpenses, myHouseContribCharges,
    remaining, myRestAVivre,
    categoryData, trendData, upcomingAnnualCharges,
    myPendingDebt,
  } = computed;

  const totalSpent = tHouseCharges + tHouseExpenses + monthlySavingsShared;
  
  // Correction: Calcul exact du temps écoulé dans le mois comptable actuel
  const periodStart = new Date(currentYear, currentMonth, startDay);
  const periodEnd = startDay <= 1 
    ? new Date(currentYear, currentMonth + 1, 0) 
    : new Date(currentYear, currentMonth + 1, startDay - 1);
    
  let accountingDayOfMonth = Math.floor((now - periodStart) / (1000 * 60 * 60 * 24)) + 1;
  accountingDayOfMonth = Math.max(1, accountingDayOfMonth); // Éviter division par 0
  
  const accountingDaysInMonth = Math.floor((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;

  const projectedExpenses = (tHouseExpenses / accountingDayOfMonth) * accountingDaysInMonth;
  const projectedRemaining = salairesSaisis
    ? totalIncome - tHouseCharges - monthlySavingsShared - projectedExpenses
    : null;

  const projectedPersoExpenses = (tPersoExpenses / accountingDayOfMonth) * accountingDaysInMonth;
  const projectedMyHouseContribExpenses = (myHouseContribExpenses / accountingDayOfMonth) * accountingDaysInMonth;
  const projectedPersoRemaining = salairesSaisis
    ? mySalary - myHouseContribCharges - projectedMyHouseContribExpenses - projectedPersoExpenses - tPersoCharges - monthlySavingsPerso
    : null;

  const monthLabel = formatAccountingMonthLabel(currentYear, currentMonth, startDay).replace(/^\w/, c => c.toUpperCase());

  const memberName = settings?.members?.find(m => m.id === uid)?.name || 'Moi';

  const activeProjects = projects
    .filter(p => p.status !== 'archived')
    .sort((a, b) => (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount));

  const hasAlerts = remaining < 0 || !salairesSaisis || upcomingAnnualCharges?.length > 0;

  return (
    <div className="page-container animate-fade-in">

      <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-gradient" style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: '400', letterSpacing: '-0.3px', marginBottom: '0.2rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{monthLabel}</p>
        </div>
        {hasAlerts && (
          <button onClick={() => document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--danger-light)', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: '700' }}>
            <AlertTriangle size={14} /> {upcomingAnnualCharges.length + (!salairesSaisis ? 1 : 0) + (remaining < 0 ? 1 : 0)} alerte(s)
          </button>
        )}
      </header>

      {/* Toggle vue */}
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '4px', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', gap: '4px' }}>
        {[{ key: 'foyer', icon: <Wallet size={14} />, label: 'Foyer' }, { key: 'perso', icon: <User size={14} />, label: memberName }].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              padding: '0.5rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              fontWeight: '700', fontSize: '0.875rem', transition: 'all 0.2s ease',
              background: view === tab.key ? 'var(--primary-gradient)' : 'transparent',
              color: view === tab.key ? 'white' : 'var(--text-secondary)',
              boxShadow: view === tab.key ? '0 2px 8px rgba(13,159,110,0.25)' : 'none',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ══ VUE FOYER ══ */}
      {view === 'foyer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="label">Reste foyer</span>
              {remaining === null
                ? <span className="error-text">⚠ Salaires non saisis</span>
                : <p className="value-large" style={{ color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatEuro(remaining)}</p>}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>sur {formatEuro(totalIncome, false)} revenus</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="label">Prévision fin de mois</span>
              {projectedRemaining === null
                ? <span className="error-text">⚠ Salaires manquants</span>
                : <p className="value-large" style={{ color: projectedRemaining >= 0 ? 'var(--warning)' : 'var(--danger)' }}>{formatEuro(projectedRemaining)}</p>}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>j.{accountingDayOfMonth} / {accountingDaysInMonth}</span>
            </div>
          </div>

          <div className="card">
            <h3 className="label" style={{ marginBottom: '1rem' }}>Budget consommé ce mois</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <BudgetGauge spent={totalSpent} total={totalIncome} label="consommé" />
              <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { label: 'Charges', val: tHouseCharges, color: 'var(--primary)' },
                  { label: 'Dépenses', val: tHouseExpenses, color: '#8b5cf6' },
                  { label: 'Épargne foyer', val: monthlySavingsShared, color: 'var(--accent)' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: '600' }}>{val.toFixed(2)} €</span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--border-solid)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: totalIncome > 0 ? `${Math.min((val / totalIncome) * 100, 100)}%` : '0%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {savings.filter(s => s.visibility === 'shared').length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 className="label" style={{ margin: 0 }}>Épargne foyer</h3>
                <button onClick={() => navigate('/savings')} className="btn-small">Gérer →</button>
              </div>
              {savings.filter(s => s.visibility === 'shared').map(s => (
                <div key={s.id} className="detail-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <PiggyBank size={13} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '0.875rem' }}>{s.name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>— {s.destination}</span>
                  </div>
                  <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '0.875rem' }}>{formatEuro(s.amount, false)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 className="label" style={{ marginBottom: '1rem' }}>Répartition par catégorie</h3>
            <CategoryPieChart data={categoryData} />
          </div>

          <div className="card">
            <h3 className="label" style={{ marginBottom: '0.5rem' }}>Foyer vs Perso — 6 derniers mois</h3>
            <MonthlyTrendChart data={trendData} />
          </div>
        </div>
      )}

      {/* ══ VUE PERSO ══ */}
      {view === 'perso' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ borderLeft: `4px solid ${myPendingDebt > 0 ? 'var(--warning)' : myPendingDebt < 0 ? 'var(--success)' : 'var(--primary)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span className="label">Ma balance foyer</span>
              <button onClick={() => navigate('/debts')} className="btn-small">Régler →</button>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: '400', color: myPendingDebt > 0 ? 'var(--warning)' : myPendingDebt < 0 ? 'var(--success)' : 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              {myPendingDebt > 0 ? '−' : myPendingDebt < 0 ? '+' : ''}{formatEuro(Math.abs(myPendingDebt))}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {myPendingDebt > 0 ? 'Vous devez reverser au foyer' : myPendingDebt < 0 ? 'Le foyer vous doit' : 'Tout est à jour !'}
            </p>
            {computed.myPendingArrears > 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: '600', marginTop: '0.25rem' }}>
                Dont {formatEuro(computed.myPendingArrears)} d'arriérés
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="label">Reste à vivre</span>
              <p className="value-large" style={{ color: myRestAVivre >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatEuro(myRestAVivre)}</p>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>sur {formatEuro(mySalary, false)} de revenus</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="label">Prévision fin de mois</span>
              {projectedPersoRemaining === null
                ? <span className="error-text">⚠ Non disponible</span>
                : <p className="value-large" style={{ color: projectedPersoRemaining >= 0 ? 'var(--warning)' : 'var(--danger)' }}>{formatEuro(projectedPersoRemaining)}</p>}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>j.{accountingDayOfMonth} / {accountingDaysInMonth}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="label">Ma part foyer</span>
              <p className="value-large" style={{ color: '#8b5cf6' }}>{formatEuro(myHouseContribution)}</p>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="label">Dépenses perso</span>
              <p className="value-large" style={{ color: 'var(--danger)' }}>{formatEuro(tPersoExpenses + tPersoCharges)}</p>
            </div>
          </div>

          {savings.filter(s => s.visibility === 'perso').length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 className="label" style={{ margin: 0 }}>Mon épargne</h3>
                <button onClick={() => navigate('/savings')} className="btn-small">Gérer →</button>
              </div>
              {savings.filter(s => s.visibility === 'perso').map(s => (
                <div key={s.id} className="detail-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <PiggyBank size={13} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.875rem' }}>{s.name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>— {s.destination}</span>
                  </div>
                  <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.875rem' }}>{formatEuro(s.amount, false)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 className="label" style={{ marginBottom: '1rem' }}>Mon budget consommé</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <BudgetGauge spent={myHouseContribution + tPersoExpenses + tPersoCharges + monthlySavingsPerso} total={mySalary} label="de mon salaire" />
              <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { label: 'Part foyer', val: myHouseContribution, color: 'var(--primary)' },
                  { label: 'Dépenses perso', val: tPersoExpenses, color: '#8b5cf6' },
                  { label: 'Charges perso', val: tPersoCharges, color: 'var(--warning)' },
                  { label: 'Épargne perso', val: monthlySavingsPerso, color: 'var(--accent)' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: '600' }}>{val.toFixed(2)} €</span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--border-solid)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: mySalary > 0 ? `${Math.min((val / mySalary) * 100, 100)}%` : '0%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PROJETS ══ */}
      {activeProjects.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 className="label" style={{ margin: 0 }}>Projets en cours</h2>
            <button onClick={() => navigate('/projects')} className="btn-small">Voir tout →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {activeProjects.slice(0, 3).map(p => {
              const Icon = PROJECT_ICONS[p.iconKey] || MoreHorizontal;
              const pct = p.targetAmount > 0 ? Math.min((p.currentAmount / p.targetAmount) * 100, 100) : 0;
              const isReached = p.status === 'reached';
              return (
                <div key={p.id} className="card" onClick={() => navigate('/projects')}
                  style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-badge" style={{ background: isReached ? 'var(--success-light)' : 'var(--primary-light)', color: isReached ? 'var(--success)' : 'var(--primary)', flexShrink: 0 }}>
                      {isReached ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.875rem' }}>{p.name}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isReached ? 'var(--success)' : 'var(--primary)' }}>{pct.toFixed(0)} %</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--border-solid)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isReached ? 'var(--success)' : 'var(--primary-gradient)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatEuro(p.currentAmount || 0, false)} / {formatEuro(p.targetAmount, false)}</span>
                        {p.targetDate && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(p.targetDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ ALERTES ══ */}
      {hasAlerts && (
        <div id="alerts-section" className="card animate-fade-in" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={15} style={{ color: 'var(--warning)' }} /> Points d'attention
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {!salairesSaisis && (
              <div className="alert-banner alert-banner-info">
                <span>💡</span>
                <span>Salaires du mois non saisis.{' '}
                  <button onClick={() => navigate('/salaries')} className="btn-small" style={{ marginLeft: '0.5rem' }}>Saisir</button>
                </span>
              </div>
            )}
            {remaining !== null && remaining < 0 && (
              <div className="alert-banner alert-banner-danger">
                <span>⚠️</span>
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Budget foyer dépassé de {formatEuro(Math.abs(remaining))}.</span>
              </div>
            )}
            {upcomingAnnualCharges?.map(c => {
              const prog = getAnnualChargeProgress(c, currentYear, currentMonth);
              return (
                <div key={c.id} className={`alert-banner ${prog.isDueThisMonth ? 'alert-banner-danger' : 'alert-banner-warning'}`}>
                  <span>{prog.isDueThisMonth ? '📅' : '⚡'}</span>
                  <span>
                    <strong>{c.name}</strong> — {prog.isDueThisMonth ? 'échéance ce mois !' : 'échéance le mois prochain'} ({formatEuro(c.annualAmount, false)})
                    {prog.remaining > 0 && <span style={{ color: 'var(--danger)', fontWeight: '700' }}> — manque {formatEuro(prog.remaining)}</span>}
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
