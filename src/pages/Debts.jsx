import React, { useState, useEffect } from 'react';
import { getAllExpenses } from '../services/expenses';
import { getAllCharges } from '../services/charges';
import { getSettings } from '../services/settings';
import { getAllMonthlySalaries } from '../services/salaries';
import { getAllSettlements, addSettlement, deleteSettlement } from '../services/settlements';
import { auth } from '../config/firebase';
import { ArrowUpDown, Landmark, User, CheckCircle2, Trash2, ChevronLeft, ChevronRight, History, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { calculateDistribution } from '../utils/finance';
import { DebtsSkeleton } from '../components/SkeletonLoader';

/* ── Composant accordéon avec logique FIFO ── */
const DetailAccordion = ({ details, settlements, currentMonth }) => {
  const [open, setOpen] = useState(false);
  if (!details || details.length === 0) return null;

  const totalSettled = (settlements || []).reduce((s, r) => s + r.amount, 0);

  // Séparer mois courant et mois passés
  const currentMonthItems = details.filter(d => d.month === currentMonth);
  const pastItems = details
    .filter(d => d.month !== currentMonth)
    .sort((a, b) => a.month.localeCompare(b.month));

  // FIFO uniquement sur les mois passés : les règlements soldent du plus ancien au plus récent
  let remainingBudget = totalSettled;
  const processedPastItems = pastItems.map(item => {
    if (remainingBudget <= 0) return { ...item, remaining: item.share };
    if (remainingBudget >= item.share) {
      remainingBudget -= item.share;
      return { ...item, remaining: 0 };
    }
    const remaining = item.share - remainingBudget;
    remainingBudget = 0;
    return { ...item, remaining };
  });

  // Seuls les arriérés réellement impayés sont affichés
  const unpaidPastItems = processedPastItems.filter(item => item.remaining > 0.01);
  const hasUnpaidArrears = unpaidPastItems.length > 0;

  // Toujours visible si mois courant existe, même si tout est soldé pour les mois passés
  if (currentMonthItems.length === 0 && !hasUnpaidArrears) return null;

  const renderItems = (items, useRemaining = false) => {
    const byMonth = {};
    items.forEach(d => {
      if (!byMonth[d.month]) byMonth[d.month] = [];
      byMonth[d.month].push(d);
    });
    return Object.keys(byMonth).sort().map(month => {
      const monthItems = byMonth[month];
      const monthTotal = monthItems.reduce((s, i) => s + (useRemaining ? i.remaining : i.share), 0);
      const monthLabel = new Date(month + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const isPast = month !== currentMonth;
      return (
        <div key={month} style={{ marginBottom: '0.75rem' }}>
          <div style={{
            fontWeight: '700', color: isPast ? 'var(--danger)' : 'var(--primary)',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            paddingBottom: '0.25rem', marginBottom: '0.35rem',
            textTransform: 'capitalize', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>
              {monthLabel}
              {isPast && <span style={{ fontSize: '0.7rem', marginLeft: '0.4rem', opacity: 0.8 }}>(arriéré impayé)</span>}
            </span>
            <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>
              {isPast ? 'Restant' : 'Sous-total'} : {monthTotal.toFixed(2)} €
            </span>
          </div>
          {monthItems.map((d, i) => {
            const displayAmt = useRemaining ? d.remaining : d.share;
            const isPartial = useRemaining && d.remaining < d.share - 0.01;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.2rem 0',
                borderBottom: i < monthItems.length - 1 ? '1px dotted var(--border-color, rgba(255,255,255,0.05))' : 'none',
              }}>
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                  <span style={{
                    display: 'inline-block', width: '1.1rem', height: '1.1rem',
                    borderRadius: '3px', textAlign: 'center', lineHeight: '1.1rem',
                    fontSize: '0.65rem', fontWeight: '700', marginRight: '0.4rem',
                    backgroundColor: d.type === 'charge' ? 'var(--info, #3b82f6)' : 'var(--warning, #f59e0b)',
                    color: '#fff',
                  }}>
                    {d.type === 'charge' ? 'C' : 'D'}
                  </span>
                  {d.name}
                  <span style={{ opacity: 0.6, marginLeft: '0.3rem' }}>
                    ({d.distributionType === '50_50' ? '50/50' : d.distributionType === 'prorata' ? 'prorata' : d.distributionType === 'hybrid' ? 'hybride' : d.distributionType === 'custom_amount' ? 'fixe' : 'perso'})
                  </span>
                </span>
                <span style={{ fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                  {isPartial ? (
                    <>
                      <span style={{ color: 'var(--warning)' }}>{displayAmt.toFixed(2)} €</span>
                      <span style={{ opacity: 0.4, fontSize: '0.72rem', marginLeft: '0.2rem' }}>/{d.share.toFixed(2)} €</span>
                    </>
                  ) : (
                    <>
                      {displayAmt.toFixed(2)} €
                      <span style={{ opacity: 0.4, fontWeight: '400', marginLeft: '0.2rem' }}>/ {Number(d.totalAmount).toFixed(2)} €</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      );
    });
  };

  const currentTotal = currentMonthItems.reduce((s, d) => s + d.share, 0);
  const arrearsTotal = unpaidPastItems.reduce((s, d) => s + d.remaining, 0);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          borderRadius: 'var(--radius-sm, 6px)', padding: '0.4rem 0.75rem',
          color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem',
          fontWeight: '600', width: '100%', justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        <FileText size={14} />
        {open ? 'Masquer le détail' : 'Voir le détail du calcul'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <div style={{ maxHeight: open ? '3000px' : '0', overflow: 'hidden', transition: 'max-height 0.4s ease' }}>
        <div style={{
          marginTop: '0.5rem', padding: '0.75rem',
          backgroundColor: 'var(--surface-color, rgba(0,0,0,0.15))',
          borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.78rem', lineHeight: '1.6',
        }}>

          {/* Mois courant — toujours affiché avec les montants bruts complets */}
          {currentMonthItems.length > 0 && renderItems(currentMonthItems, false)}

          {/* Arriérés impayés des mois passés (après FIFO) */}
          {hasUnpaidArrears && (
            <div style={{
              marginTop: currentMonthItems.length > 0 ? '0.5rem' : 0,
              paddingTop: currentMonthItems.length > 0 ? '0.5rem' : 0,
              borderTop: currentMonthItems.length > 0 ? '1px dashed var(--danger)' : 'none',
            }}>
              <div style={{ color: 'var(--danger)', fontWeight: '700', marginBottom: '0.4rem', fontSize: '0.77rem' }}>
                ⚠ Arriérés impayés des mois précédents
              </div>
              {renderItems(unpaidPastItems, true)}
            </div>
          )}

          {/* Résumé */}
          <div style={{ borderTop: '2px solid var(--primary)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '0.85rem' }}>
            <span>Total mois en cours :</span>
            <span>{currentTotal.toFixed(2)} €</span>
          </div>
          {hasUnpaidArrears && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '0.82rem', color: 'var(--danger)', paddingTop: '0.25rem' }}>
              <span>+ Arriérés restants :</span>
              <span>{arrearsTotal.toFixed(2)} €</span>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

const Debts = ({ householdId }) => {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settings, setSettings] = useState(null);
  const [settleInputs, setSettleInputs] = useState({});
  const [debtsData, setDebtsData] = useState({
    toCommon: {},
    toPartners: {},
    settlements: [],
    // Logs détaillés pour le bandeau déroulant
    detailsCommon: {},   // { memberId: { accountId: [ {name, share, totalAmount, month, type, distributionType} ] } }
    detailsPartners: {}, // { fromId: { toId: [ ... ] } }
  });

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth();

  useEffect(() => {
    fetchData();
  }, [householdId, currentDate]);

  const fetchData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId) return;
    setLoading(true);

    try {
      const [allExpenses, allCharges, settingsData, allSalaries, allSettlements] = await Promise.all([
        getAllExpenses(householdId, uid),
        getAllCharges(householdId, uid),
        getSettings(householdId),
        getAllMonthlySalaries(householdId),
        getAllSettlements(householdId)
      ]);

      setSettings(settingsData);
      const membersArr = settingsData.members;
      if (membersArr.length < 2) return;

      // Cumulative Debt Calculation
      const toCommon = {};
      const toPartners = {};
      const detailsCommon = {};
      const detailsPartners = {};

      membersArr.forEach(m => {
        toCommon[m.id] = {};
        detailsCommon[m.id] = {};
        settingsData.accounts.filter(a => a.visibility === 'shared').forEach(a => {
          toCommon[m.id][a.id] = { current: 0, arrears: 0 };
          detailsCommon[m.id][a.id] = [];
        });
        toPartners[m.id] = {};
        detailsPartners[m.id] = {};
        membersArr.forEach(m2 => {
          if (m.id !== m2.id) {
            toPartners[m.id][m2.id] = { current: 0, arrears: 0 };
            detailsPartners[m.id][m2.id] = [];
          }
        });
      });

      const getMemberShares = (amount, distType, customPercentages, customAmounts, refDate) =>
        calculateDistribution(amount, distType || '50_50', membersArr, {}, customPercentages, customAmounts, allSalaries, refDate);

      // Date de départ : première transaction connue, ou à défaut il y a 24 mois
      const allDates = [
        ...allExpenses.map(e => new Date(e.date || e.createdAt)),
        ...allCharges.map(c => new Date(c.validFrom ? c.validFrom + '-01' : '9999-01-01')).filter(d => d.getFullYear() < 9999),
      ].filter(d => !isNaN(d));

      const fallbackStart = new Date();
      fallbackStart.setMonth(fallbackStart.getMonth() - 24);
      fallbackStart.setDate(1);

      const earliestDate = allDates.length > 0
        ? new Date(Math.min(...allDates))
        : fallbackStart;

      const startYear = earliestDate.getFullYear();
      const startMonth = earliestDate.getMonth();
      const endMonth = new Date(selectedYear, selectedMonth, 1);

      let currentLoopMonth = new Date(startYear, startMonth, 1);

      while (currentLoopMonth <= endMonth) {
        const y = currentLoopMonth.getFullYear();
        const mon = currentLoopMonth.getMonth();
        const monthStr = `${y}-${(mon + 1).toString().padStart(2, '0')}`;
        const isCurrentMonth = (y === selectedYear && mon === selectedMonth);

        // Charges
        allCharges.filter(c => {
          const from = c.validFrom || '0000-01';
          const to = c.validTo || '9999-12';
          return monthStr >= from && monthStr <= to;
        }).forEach(c => {
          const shares = getMemberShares(c.amount, c.distributionType, c.customPercentages, c.customAmounts, currentLoopMonth);
          const account = settingsData.accounts.find(a => a.id === c.accountId);

          Object.keys(shares).forEach(mId => {
            const share = shares[mId];
            if (share <= 0) return;

            if (account?.visibility === 'shared') {
              if (isCurrentMonth) {
                toCommon[mId][account.id].current += share;
              } else {
                toCommon[mId][account.id].arrears += share;
              }
              detailsCommon[mId][account.id].push({
                name: c.name || c.description || 'Charge sans nom',
                share, totalAmount: c.amount, month: monthStr,
                type: 'charge', distributionType: c.distributionType,
                period: isCurrentMonth ? 'current' : 'arrears',
              });
            } else if (account?.ownerId && account.ownerId !== mId) {
              if (isCurrentMonth) {
                toPartners[mId][account.ownerId].current += share;
              } else {
                toPartners[mId][account.ownerId].arrears += share;
              }
              detailsPartners[mId][account.ownerId].push({
                name: c.name || c.description || 'Charge sans nom',
                share, totalAmount: c.amount, month: monthStr,
                type: 'charge', distributionType: c.distributionType,
                period: isCurrentMonth ? 'current' : 'arrears',
              });
            }
          });
        });

        // Expenses
        allExpenses.filter(e => {
          const d = new Date(e.date || e.createdAt);
          return d.getFullYear() === y && d.getMonth() === mon;
        }).forEach(e => {
          const shares = getMemberShares(e.amount, e.distributionType, e.customPercentages, e.customAmounts, currentLoopMonth);
          const account = settingsData.accounts.find(a => a.id === e.accountId);

          Object.keys(shares).forEach(mId => {
            const share = shares[mId];
            if (share <= 0) return;

            if (account?.visibility === 'shared') {
              if (isCurrentMonth) toCommon[mId][account.id].current += share;
              else toCommon[mId][account.id].arrears += share;
              detailsCommon[mId][account.id].push({
                name: e.description || e.name || 'Dépense sans nom',
                share, totalAmount: e.amount, month: monthStr,
                type: 'expense', distributionType: e.distributionType,
                period: isCurrentMonth ? 'current' : 'arrears',
              });
            } else if (account?.ownerId && account.ownerId !== mId) {
              if (isCurrentMonth) toPartners[mId][account.ownerId].current += share;
              else toPartners[mId][account.ownerId].arrears += share;
              detailsPartners[mId][account.ownerId].push({
                name: e.description || e.name || 'Dépense sans nom',
                share, totalAmount: e.amount, month: monthStr,
                type: 'expense', distributionType: e.distributionType,
                period: isCurrentMonth ? 'current' : 'arrears',
              });
            }
          });
        });

        currentLoopMonth.setMonth(currentLoopMonth.getMonth() + 1);
      }

      // Filter settlements up to selected month
      const limitDateSettlements = new Date(selectedYear, selectedMonth + 1, 1);
      const filteredSettlements = allSettlements.filter(s => {
        const sDate = new Date(s.year, s.month, 1);
        return sDate < limitDateSettlements;
      });

      setDebtsData({
        toCommon,
        toPartners,
        settlements: filteredSettlements,
        monthSettlements: allSettlements.filter(s => s.year === selectedYear && s.month === selectedMonth),
        detailsCommon,
        detailsPartners,
      });
    } catch (error) {
      console.error("Debts fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (type, fromId, toId, defaultAmount) => {
    const key = `${type}-${fromId}-${toId}`;
    const amount = parseFloat(settleInputs[key] ?? defaultAmount);
    if (!amount || amount <= 0) return;
    try {
      await addSettlement(householdId, {
        year: selectedYear, month: selectedMonth, fromId, toId, amount, type
      });
      setSettleInputs(prev => { const n = {...prev}; delete n[key]; return n; });
      fetchData();
    } catch (error) {
      alert("Erreur lors du remboursement");
    }
  };

  const deleteSettle = async (id) => {
    try {
      await deleteSettlement(householdId, id);
      fetchData();
    } catch (error) {
      alert("Erreur");
    }
  };

  const calculateRemaining = (type, fromId, toId, arrearsVal, currentVal) => {
    const paid = debtsData.settlements
      .filter(s => s.type === type && s.fromId === fromId && s.toId === toId)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const remainingArrears = Math.max(0, arrearsVal - paid);
    const remainingPaidAfterArrears = Math.max(0, paid - arrearsVal);
    const remainingCurrent = Math.max(0, currentVal - remainingPaidAfterArrears);

    return {
      arrears: remainingArrears,
      current: remainingCurrent,
      total: remainingArrears + remainingCurrent
    };
  };

  const getSettlementsFor = (type, fromId, toId) => {
    return debtsData.settlements.filter(s => s.type === type && s.fromId === fromId && s.toId === toId);
  };

  const changeMonth = (delta) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + delta);
    setCurrentDate(next);
  };

  if (loading) return <DebtsSkeleton />;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>Dettes & Remboursements</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Récapitulatif cumulé de ce que chacun doit reverser</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {settings?.members?.map(m => (
          <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="avatar">{m.name.charAt(0)}</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{m.name}</h2>
            </div>

            {/* Owed to Common Accounts */}
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '-0.5rem' }}>Vers les Comptes Communs</h3>
            {Object.keys(debtsData.toCommon[m.id] || {}).map(accId => {
              const account = settings.accounts.find(a => a.id === accId);
              const { arrears, current, total } = calculateRemaining('common', m.id, accId, debtsData.toCommon[m.id][accId].arrears, debtsData.toCommon[m.id][accId].current);

              if (total < 0.01 && (debtsData.toCommon[m.id][accId].arrears + debtsData.toCommon[m.id][accId].current) < 0.01) return null;

              return (
                <div key={accId} style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <Landmark size={18} /> Recharger {account?.name || 'Compte commun'}
                    </div>
                    {total === 0 && <CheckCircle2 size={20} color="var(--success)" />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: '700', color: total >= 0.01 ? 'var(--text-primary)' : 'var(--success)' }}>
                        {total.toFixed(2)} €
                      </span>
                    </div>
                    {arrears >= 0.01 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: '600' }}>
                        Dont {arrears.toFixed(2)} € d'impayés passés
                      </div>
                    )}
                    {current >= 0.01 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {current.toFixed(2)} € pour {currentDate.toLocaleDateString('fr-FR', { month: 'long' })}
                      </div>
                    )}
                  </div>

                  {/* ── Bandeau déroulant détaillé ── */}
                  <DetailAccordion
                    details={debtsData.detailsCommon?.[m.id]?.[accId] || []}
                    settlements={getSettlementsFor('common', m.id, accId)}
                    currentMonth={`${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`}
                  />

                  {total >= 0.01 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={total}
                        className="input-field"
                        style={{ flex: 1, fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
                        placeholder={total.toFixed(2)}
                        value={settleInputs[`common-${m.id}-${accId}`] ?? ''}
                        onChange={e => setSettleInputs(prev => ({ ...prev, [`common-${m.id}-${accId}`]: e.target.value }))}
                      />
                      <button className="btn btn-primary" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }} onClick={() => handleSettle('common', m.id, accId, total)}>
                        Solder
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Owed to Partner */}
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '-0.5rem', marginTop: '0.5rem' }}>Remboursements Personnels</h3>
            {Object.keys(debtsData.toPartners[m.id]).map(partnerId => {
              const pName = settings.members.find(x => x.id === partnerId)?.name;
              const { arrears, current, total } = calculateRemaining('partner', m.id, partnerId, debtsData.toPartners[m.id][partnerId].arrears, debtsData.toPartners[m.id][partnerId].current);

              if (total < 0.01 && (debtsData.toPartners[m.id][partnerId].arrears + debtsData.toPartners[m.id][partnerId].current) < 0.01) return null;

              return (
                <div key={partnerId} style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <User size={18} /> À rembourser à {pName}
                    </div>
                    {total === 0 && <CheckCircle2 size={20} color="var(--success)" />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '700', color: total >= 0.01 ? 'var(--text-primary)' : 'var(--success)' }}>
                        {total.toFixed(2)} €
                      </span>
                    </div>
                    {arrears >= 0.01 && <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: '600' }}>Dont {arrears.toFixed(2)} € d'arriérés</div>}
                  </div>

                  {/* ── Bandeau déroulant détaillé ── */}
                  <DetailAccordion
                    details={debtsData.detailsPartners?.[m.id]?.[partnerId] || []}
                    settlements={getSettlementsFor('partner', m.id, partnerId)}
                    currentMonth={`${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`}
                  />

                  {total >= 0.01 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={total}
                        className="input-field"
                        style={{ flex: 1, fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
                        placeholder={total.toFixed(2)}
                        value={settleInputs[`partner-${m.id}-${partnerId}`] ?? ''}
                        onChange={e => setSettleInputs(prev => ({ ...prev, [`partner-${m.id}-${partnerId}`]: e.target.value }))}
                      />
                      <button className="btn btn-outline" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }} onClick={() => handleSettle('partner', m.id, partnerId, total)}>
                        Rembourser
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <History size={20} /> Règlements de {currentDate.toLocaleDateString('fr-FR', { month: 'long' })}
        </h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {debtsData.monthSettlements?.slice().reverse().map(s => (
            <div key={s.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <div>
                <strong>{settings.members.find(m => m.id === s.fromId)?.name}</strong> a versé
                <strong style={{ margin: '0 0.25rem' }}>{s.amount.toFixed(2)} €</strong>
                {s.type === 'common' ? 'au compte commun' : `à ${settings.members.find(m => m.id === s.toId)?.name}`}
              </div>
              <button onClick={() => deleteSettle(s.id)} style={{ color: 'var(--danger)', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {debtsData.monthSettlements?.length === 0 && <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Aucun règlement enregistré pour ce mois.</p>}
        </div>
      </div>
    </div>
  );
};

export default Debts;
