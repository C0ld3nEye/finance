import React, { useState, useEffect } from 'react';
import { getAllExpenses } from '../services/expenses';
import { getAllCharges } from '../services/charges';
import { getSettings } from '../services/settings';
import { getAllMonthlySalaries } from '../services/salaries';
import { getAllSettlements, addSettlement, deleteSettlement } from '../services/settlements';
import { auth } from '../config/firebase';
import { ArrowUpDown, Landmark, User, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, History } from 'lucide-react';

const Debts = ({ householdId }) => {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settings, setSettings] = useState(null);
  const [debtsData, setDebtsData] = useState({
    toCommon: {}, // { memberId: { accountId: amount } }
    toPartners: {}, 
    settlements: []
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
      const toCommon = {}; // { memberId: { accountId: { current: 0, arrears: 0 } } }
      const toPartners = {}; // { fromId: { toId: { current: 0, arrears: 0 } } }
      membersArr.forEach(m => {
        toCommon[m.id] = {};
        settingsData.accounts.filter(a => a.visibility === 'shared').forEach(a => toCommon[m.id][a.id] = { current: 0, arrears: 0 });
        toPartners[m.id] = {};
        membersArr.forEach(m2 => { if(m.id !== m2.id) toPartners[m.id][m2.id] = { current: 0, arrears: 0 }; });
      });

      const getMemberShares = (amount, distType, customPercentages, refDate) => {
        let d = new Date(refDate);
        const y = d.getFullYear();
        const mon = d.getMonth();
        const mSal = allSalaries.find(s => s.id === `${y}-${(mon + 1).toString().padStart(2, '0')}`);
        
        const numAmount = Number(amount);
        const m1 = membersArr[0];
        const m2 = membersArr[1];

        if (distType === '50_50') return { [m1.id]: numAmount / 2, [m2.id]: numAmount / 2 };
        if (distType === 'prorata') {
          const s1 = mSal?.salaries?.[m1.id] || 0;
          const s2 = mSal?.salaries?.[m2.id] || 0;
          const total = s1 + s2;
          if (total === 0) return { [m1.id]: numAmount / 2, [m2.id]: numAmount / 2 };
          return { [m1.id]: numAmount * (s1 / total), [m2.id]: numAmount * (s2 / total) };
        }
        if (distType === 'custom') {
          const res = {};
          membersArr.forEach(m => res[m.id] = (numAmount * (customPercentages?.[m.id] || 0)) / 100);
          return res;
        }
        return {};
      };

      const startYear = 2026;
      const startMonth = 0;
      const endMonth = new Date(selectedYear, selectedMonth, 1);

      let currentLoopMonth = new Date(startYear, startMonth, 1);

      while (currentLoopMonth <= endMonth) {
        const y = currentLoopMonth.getFullYear();
        const mon = currentLoopMonth.getMonth();
        const monthStr = `${y}-${(mon + 1).toString().padStart(2, '0')}`;
        const isCurrentMonth = (y === selectedYear && mon === selectedMonth);
        
        // Charges : On boucle sur TOUTES les charges visibles par au moins un membre
        allCharges.filter(c => {
          const from = c.validFrom || '0000-01';
          const to = c.validTo || '9999-12';
          return monthStr >= from && monthStr <= to;
        }).forEach(c => {
          const shares = getMemberShares(c.amount, c.distributionType, c.customPercentages, currentLoopMonth);
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
            } else if (account?.ownerId && account.ownerId !== mId) {
              if (isCurrentMonth) {
                toPartners[mId][account.ownerId].current += share;
              } else {
                toPartners[mId][account.ownerId].arrears += share;
              }
            }
          });
        });

        // Expenses
        allExpenses.filter(e => {
          const d = new Date(e.date || e.createdAt);
          return d.getFullYear() === y && d.getMonth() === mon;
        }).forEach(e => {
          const shares = getMemberShares(e.amount, e.distributionType, e.customPercentages, currentLoopMonth);
          const account = settingsData.accounts.find(a => a.id === e.accountId);
          
          Object.keys(shares).forEach(mId => {
            const share = shares[mId];
            if (share <= 0) return;

            if (account?.visibility === 'shared') {
              if (isCurrentMonth) toCommon[mId][account.id].current += share;
              else toCommon[mId][account.id].arrears += share;
            } else if (account?.ownerId && account.ownerId !== mId) {
              if (isCurrentMonth) toPartners[mId][account.ownerId].current += share;
              else toPartners[mId][account.ownerId].arrears += share;
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
        monthSettlements: allSettlements.filter(s => s.year === selectedYear && s.month === selectedMonth)
      });
    } catch (error) {
      console.error("Debts fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (type, fromId, toId, amount) => {
    if (amount <= 0) return;
    try {
      const s = await addSettlement(householdId, {
        year: selectedYear, month: selectedMonth, fromId, toId, amount, type
      });
      fetchData(); // Refresh everything for accuracy
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

  const changeMonth = (delta) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + delta);
    setCurrentDate(next);
  };

  if (loading) return <div className="page-container" style={{ padding: '2rem' }}>Chargement des dettes...</div>;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>Dettes & Remboursements</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Récapitulatif cumulé de ce que chacun doit reverser</p>
      </header>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-color)' }}>
        <button className="btn btn-outline" style={{ padding: '0.5rem', border: 'none' }} onClick={() => changeMonth(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'capitalize' }}>
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
              
              if (total === 0 && (debtsData.toCommon[m.id][accId].arrears + debtsData.toCommon[m.id][accId].current) === 0) return null;

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
                      <span style={{ fontSize: '1.75rem', fontWeight: '700', color: total > 0 ? 'var(--text-primary)' : 'var(--success)' }}>
                        {total.toFixed(2)} €
                      </span>
                    </div>
                    {arrears > 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: '600' }}>
                        Dont {arrears.toFixed(2)} € d'impayés passés
                      </div>
                    )}
                    {current > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {current.toFixed(2)} € pour {currentDate.toLocaleDateString('fr-FR', { month: 'long' })}
                      </div>
                    )}
                  </div>

                  {total > 0 && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '0.85rem' }} onClick={() => handleSettle('common', m.id, accId, total)}>
                      Solder {total.toFixed(2)} €
                    </button>
                  )}
                </div>
              );
            })}

            {/* Owed to Partner */}
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '-0.5rem', marginTop: '0.5rem' }}>Remboursements Personnels</h3>
            {Object.keys(debtsData.toPartners[m.id]).map(partnerId => {
              const pName = settings.members.find(x => x.id === partnerId)?.name;
              const { arrears, current, total } = calculateRemaining('partner', m.id, partnerId, debtsData.toPartners[m.id][partnerId].arrears, debtsData.toPartners[m.id][partnerId].current);

              if (total === 0 && (debtsData.toPartners[m.id][partnerId].arrears + debtsData.toPartners[m.id][partnerId].current) === 0) return null;

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
                      <span style={{ fontSize: '1.25rem', fontWeight: '700', color: total > 0 ? 'var(--text-primary)' : 'var(--success)' }}>
                        {total.toFixed(2)} €
                      </span>
                    </div>
                    {arrears > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: '600' }}>Dont {arrears.toFixed(2)} € d'arriérés</div>}
                  </div>

                  {total > 0 && (
                    <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem', fontSize: '0.85rem' }} onClick={() => handleSettle('partner', m.id, partnerId, total)}>
                      Rembourser {total.toFixed(2)} €
                    </button>
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
                <AlertCircle size={18} />
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
