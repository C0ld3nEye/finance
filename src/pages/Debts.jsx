import React, { useState, useMemo } from 'react';
import { addSettlement, deleteSettlement } from '../services/settlements';
import { isChargeVisibleTo } from '../services/charges';
import { isExpenseVisibleTo } from '../services/expenses';
import { isChargeActiveInMonth, isInAccountingMonth, shiftAccountingMonth, getAccountingMonth, formatAccountingMonthLabel } from '../utils/monthUtils';
import { useHouseholdData } from '../hooks/useHouseholdData';
import { pb } from '../config/pocketbase';
import {
  ArrowUpDown, Landmark, User, CheckCircle2, Trash2,
  ChevronLeft, ChevronRight, History, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { calculateHouseholdDebts } from '../utils/debtUtils';
import { DebtsSkeleton } from '../components/SkeletonLoader';
import { formatEuro } from '../utils/finance';

/* ── Accordéon détail ── */
const DetailAccordion = ({ details, mySettlements, currentMonthKey }) => {
  const [open, setOpen] = useState(false);
  if (!details || details.length === 0) return null;

  const totalSettled = mySettlements.reduce((s, r) => s + r.amount, 0);
  const current = details.filter(d => d.month === currentMonthKey);
  const past = details.filter(d => d.month !== currentMonthKey).sort((a, b) => a.month.localeCompare(b.month));

  let budget = totalSettled;
  const processedPast = past.map(item => {
    if (budget <= 0) return { ...item, remaining: item.share };
    if (budget >= item.share) { budget -= item.share; return { ...item, remaining: 0 }; }
    const remaining = item.share - budget; budget = 0; return { ...item, remaining };
  }).filter(i => i.remaining > 0.01);

  if (current.length === 0 && processedPast.length === 0) return null;

  const renderItems = (items, useRemaining = false) => {
    const byMonth = {};
    items.forEach(d => { if (!byMonth[d.month]) byMonth[d.month] = []; byMonth[d.month].push(d); });
    return Object.keys(byMonth).sort().map(month => {
      const its = byMonth[month];
      const total = its.reduce((s, i) => s + (useRemaining ? i.remaining : i.share), 0);
      const label = new Date(month + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const isPast = month !== currentMonthKey;
      return (
        <div key={month} style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: '700', color: isPast ? 'var(--danger)' : 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', textTransform: 'capitalize' }}>
            <span>{label}{isPast && <span style={{ fontSize: '0.7rem', marginLeft: '0.4rem', opacity: 0.8 }}>(arriéré)</span>}</span>
            <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{formatEuro(total)}</span>
          </div>
          {its.map((d, i) => {
            const amt = useRemaining ? d.remaining : d.share;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: i < its.length - 1 ? '1px dotted var(--border-color)' : 'none' }}>
                <span style={{ color: 'var(--text-secondary)', flex: 1, fontSize: '0.8rem' }}>
                  <span style={{ display: 'inline-block', width: '1.1rem', height: '1.1rem', borderRadius: '3px', textAlign: 'center', lineHeight: '1.1rem', fontSize: '0.65rem', fontWeight: '700', marginRight: '0.4rem', backgroundColor: d.type === 'charge' ? 'var(--accent)' : 'var(--warning)', color: '#fff' }}>
                    {d.type === 'charge' ? 'C' : 'D'}
                  </span>
                  {d.name}
                </span>
                <span style={{ fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{formatEuro(amt)} <span style={{ opacity: 0.4 }}>/ {formatEuro(d.totalAmount)}</span></span>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid var(--border-solid)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', width: '100%', justifyContent: 'center' }}>
        <FileText size={14} />{open ? 'Masquer le détail' : 'Voir le détail'}{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <div style={{ maxHeight: open ? '3000px' : '0', overflow: 'hidden', transition: 'max-height 0.4s ease' }}>
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', lineHeight: '1.6' }}>
          {current.length > 0 && renderItems(current, false)}
          {processedPast.length > 0 && (
            <div style={{ marginTop: current.length > 0 ? '0.5rem' : 0, paddingTop: current.length > 0 ? '0.5rem' : 0, borderTop: current.length > 0 ? '1px dashed var(--danger)' : 'none' }}>
              <div style={{ color: 'var(--danger)', fontWeight: '700', marginBottom: '0.4rem' }}>⚠ Arriérés impayés des mois précédents</div>
              {renderItems(processedPast, true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Debts = ({ householdId }) => {
  const uid = pb.authStore.model?.id;
  const { charges, expenses, settlements, salaries, settings, loading } = useHouseholdData(householdId);

  const startDay = settings?.accountStartDay || 1;
  const now = new Date();
  const { year: nowYear, month: nowMonth } = getAccountingMonth(now, startDay);

  const [offset, setOffset] = useState(0); // 0 = mois courant, -1 = précédent, etc.
  const [settleInputs, setSettleInputs] = useState({});

  const { year: selectedYear, month: selectedMonth } = useMemo(
    () => shiftAccountingMonth(nowYear, nowMonth, offset),
    [nowYear, nowMonth, offset]
  );

  const currentMonthKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;

  const debtsData = useMemo(() => {
    if (!settings) return null;
    return calculateHouseholdDebts(
      settings.members,
      settings.accounts,
      expenses,
      charges,
      settlements,
      salaries,
      startDay,
      selectedYear,
      selectedMonth
    );
  }, [charges, expenses, settlements, salaries, settings, selectedYear, selectedMonth, currentMonthKey, startDay]);

  const calcRemaining = (type, fromId, toId, arrears, current) => {
    if (!debtsData) return { arrears: 0, current: 0, total: 0 };
    // Règlements des mois précédents → couvrent les arriérés UNIQUEMENT (excédent absorbé, pas de débordement sur le courant)
    const pastPaid = debtsData.filteredSettlements
      .filter(s => s.type === type && s.fromId === fromId && s.toId === toId && !(s.year === selectedYear && s.month === selectedMonth))
      .reduce((a, s) => a + s.amount, 0);
    // Règlements du mois courant → couvrent d'abord les arriérés restants, puis le courant
    const currentPaid = debtsData.monthSettlements
      .filter(s => s.type === type && s.fromId === fromId && s.toId === toId)
      .reduce((a, s) => a + s.amount, 0);
    // Étape 1 : arriérés restants après règlements passés (pas de débordement)
    const arrearsAfterPast = Math.max(0, arrears - pastPaid);
    // Étape 2 : règlements du mois courant réduisent d'abord les arriérés restants
    const remArrears = Math.max(0, arrearsAfterPast - currentPaid);
    // Étape 3 : l'excédent des règlements courants (après avoir couvert les arriérés) réduit le courant
    const excessForCurrent = Math.max(0, currentPaid - arrearsAfterPast);
    const remCurrent = Math.max(0, current - excessForCurrent);
    return { arrears: remArrears, current: remCurrent, total: remArrears + remCurrent };
  };

  const handleSettle = async (type, fromId, toId, defaultAmt) => {
    const key = `${type}-${fromId}-${toId}`;
    const amount = parseFloat(settleInputs[key] ?? defaultAmt);
    if (!amount || amount <= 0) return;
    await addSettlement(householdId, { year: selectedYear, month: selectedMonth, fromId, toId, amount, type });
    setSettleInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
    // Pas besoin de fetchData : onSnapshot rafraîchit automatiquement
  };

  if (loading) return <DebtsSkeleton />;
  if (!debtsData || !settings) return <div className="page-container"><p style={{ color: 'var(--text-secondary)' }}>Données en cours de chargement…</p></div>;

  const monthLabel = formatAccountingMonthLabel(selectedYear, selectedMonth, startDay).replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="page-container animate-fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '400', marginBottom: '0.2rem' }}>Dettes & Remboursements</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Récapitulatif cumulé des reversements</p>
      </header>


      <div className="month-nav">
        <button style={{ padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setOffset(o => o - 1)}><ChevronLeft size={22} /></button>
        <h2 className="month-nav-title">{monthLabel}</h2>
        <button style={{ padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setOffset(o => o + 1)}><ChevronRight size={22} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {settings.members.map(m => (
          <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div className="avatar">{m.name.charAt(0)}</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>{m.name}</h2>
            </div>

            <div>
              <p className="label" style={{ marginBottom: '0.75rem' }}>Vers les comptes communs</p>
              {Object.keys(debtsData.toCommon[m.id] || {}).map(accId => {
                const acc = settings.accounts.find(a => a.id === accId);
                const raw = debtsData.toCommon[m.id][accId];
                const { arrears, current, total } = calcRemaining('common', m.id, accId, raw.arrears, raw.current);
                if (total < 0.01 && raw.arrears + raw.current < 0.01) return null;
                const key = `common-${m.id}-${accId}`;
                const settles = debtsData.filteredSettlements.filter(s => s.type === 'common' && s.fromId === m.id && s.toId === accId);
                return (
                  <div key={accId} style={{ padding: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary)', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <Landmark size={16} /> {acc?.name || 'Compte commun'}
                      </div>
                      {total === 0 && <CheckCircle2 size={18} color="var(--success)" />}
                    </div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: total >= 0.01 ? 'var(--text-primary)' : 'var(--success)', margin: '0 0 0.25rem' }}>{formatEuro(total)}</p>
                    {arrears >= 0.01 && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: '600' }}>Dont {formatEuro(arrears)} d'arriérés</p>}
                    {current >= 0.01 && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{formatEuro(current)} ce mois</p>}
                    <DetailAccordion details={debtsData.detailsCommon?.[m.id]?.[accId] || []} mySettlements={settles} currentMonthKey={currentMonthKey} />
                    {total >= 0.01 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', alignItems: 'center' }}>
                        <input type="number" min="0.01" step="0.01" max={total} className="input-field" style={{ flex: 1, fontSize: '0.875rem', padding: '0.45rem 0.75rem' }} placeholder={total.toFixed(2)} value={settleInputs[key] ?? ''} onChange={e => setSettleInputs(p => ({ ...p, [key]: e.target.value }))} />
                        <button className="btn btn-primary" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', padding: '0.45rem 0.875rem' }} onClick={() => handleSettle('common', m.id, accId, total)}>Solder</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <p className="label" style={{ marginBottom: '0.75rem' }}>Remboursements personnels</p>
              {Object.keys(debtsData.toPartners[m.id] || {}).map(partnerId => {
                const pName = settings.members.find(x => x.id === partnerId)?.name;
                const raw = debtsData.toPartners[m.id][partnerId];
                const { arrears, current, total } = calcRemaining('partner', m.id, partnerId, raw.arrears, raw.current);
                if (total < 0.01 && raw.arrears + raw.current < 0.01) return null;
                const key = `partner-${m.id}-${partnerId}`;
                const settles = debtsData.filteredSettlements.filter(s => s.type === 'partner' && s.fromId === m.id && s.toId === partnerId);
                return (
                  <div key={partnerId} style={{ padding: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <User size={16} /> À {pName}
                      </div>
                      {total === 0 && <CheckCircle2 size={18} color="var(--success)" />}
                    </div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: total >= 0.01 ? 'var(--text-primary)' : 'var(--success)', margin: '0 0 0.25rem' }}>{formatEuro(total)}</p>
                    {arrears >= 0.01 && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: '600' }}>Dont {formatEuro(arrears)} d'arriérés</p>}
                    <DetailAccordion details={debtsData.detailsPartners?.[m.id]?.[partnerId] || []} mySettlements={settles} currentMonthKey={currentMonthKey} />
                    {total >= 0.01 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', alignItems: 'center' }}>
                        <input type="number" min="0.01" step="0.01" max={total} className="input-field" style={{ flex: 1, fontSize: '0.875rem', padding: '0.45rem 0.75rem' }} placeholder={total.toFixed(2)} value={settleInputs[key] ?? ''} onChange={e => setSettleInputs(p => ({ ...p, [key]: e.target.value }))} />
                        <button className="btn btn-primary" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', padding: '0.45rem 0.875rem' }} onClick={() => handleSettle('partner', m.id, partnerId, total)}>Rembourser</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Historique des règlements du mois */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <History size={18} /> Règlements de {monthLabel}
        </h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {debtsData.monthSettlements.slice().reverse().map(s => (
            <div key={s.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
              <div>
                <strong>{settings.members.find(m => m.id === s.fromId)?.name}</strong> a versé{' '}
                <strong style={{ margin: '0 0.25rem' }}>{formatEuro(s.amount)}</strong>
                {s.type === 'common' ? 'au compte commun' : `à ${settings.members.find(m => m.id === s.toId)?.name}`}
              </div>
              <button onClick={() => deleteSettlement(householdId, s.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {debtsData.monthSettlements.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>Aucun règlement ce mois.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Debts;
