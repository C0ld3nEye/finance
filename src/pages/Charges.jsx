import React, { useState, useMemo } from 'react';
import { addCharge, updateCharge, deleteCharge, isChargeVisibleTo } from '../services/charges';
import { useHouseholdData } from '../hooks/useHouseholdData';
import { isChargeActiveInMonth, getAccountingMonth, shiftAccountingMonth, formatAccountingMonthLabel } from '../utils/monthUtils';
import { auth } from '../config/firebase';
import {
  Plus, Trash2, PieChart, Users, Lock, Edit2, X,
  ChevronLeft, ChevronRight, Landmark, Eye, Calendar, Info, RefreshCw
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { CATEGORIES, getCategoryConfig } from '../constants/categories';
import { calculateDistribution as calcDist, getAnnualChargeProgress, formatEuro, formatDistributionLabel } from '../utils/finance';
import { findSalariesForMonth } from '../services/salaries';
import { ListPageSkeleton } from '../components/SkeletonLoader';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];



const emptyCharge = {
  name: '', amount: '', accountId: '', distributionType: 'prorata',
  customPercentages: {}, customAmounts: {}, visibility: 'shared',
  dueDate: 1, category: 'Alimentation', frequency: 'monthly',
  annualAmount: '', annualDueDate: '',
};
const DistributionPreview = ({ amount, type, customPct, customAmts, settings, calcDist2 }) => {
  if (!amount || !settings?.members) return null;
  const dist = calcDist2(amount, type, customPct, customAmts);
  return (
    <div style={{ background: 'var(--primary-light)', padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', color: 'var(--primary)', fontSize: '0.85rem' }}>
        <PieChart size={16} /> Répartition :
      </div>
      {settings.members.map(m => (
        <div key={m.id} style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{m.name} : </span>
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatEuro(dist[m.id])}</span>
        </div>
      ))}
    </div>
  );
};

const ChargeForm = ({ data, setData, onSubmit, onCancel, title, settings, uid, calcDist2, isModal = false }) => {
  const availAcc = settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === uid) || [];
  
  const formContent = (
    <div className={isModal ? "flex-col-1 overflow-hidden" : ""}>
      <div className={isModal ? "modal-header" : ""} style={!isModal ? { padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-solid)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)' } : {}}>
        <h3 style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>{title}</h3>
        <button type="button" onClick={onCancel} style={{ color: 'var(--text-muted)', padding: '0.5rem' }}><X size={22} /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className={isModal ? "modal-body" : ""} style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', padding: !isModal ? '1.5rem' : undefined }}>
          <div>
            <label className="label">Nom</label>
            <input className="input-field" required placeholder="ex: Loyer, Netflix…" value={data.name} onChange={e => setData(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input-field" value={data.category} onChange={e => setData(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fréquence</label>
            <select className="input-field" value={data.frequency || 'monthly'} onChange={e => setData(p => ({ ...p, frequency: e.target.value }))}>
              <option value="monthly">Mensuelle</option>
              <option value="annual">Annuelle (lissée / 12)</option>
            </select>
          </div>
          {data.frequency === 'annual' ? (
            <>
              <div>
                <label className="label">Montant annuel (€)</label>
                <input className="input-field" type="number" step="0.01" required value={data.annualAmount}
                  onChange={e => setData(p => ({ ...p, annualAmount: e.target.value, amount: e.target.value ? (Number(e.target.value) / 12).toFixed(2) : '' }))} />
              </div>
              <div>
                <label className="label">Mois d'échéance</label>
                <select className="input-field" value={data.annualDueDate} onChange={e => setData(p => ({ ...p, annualDueDate: e.target.value }))}>
                  <option value="">Sélectionner…</option>
                  {MONTHS_FR.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Mensualité provisionnée</label>
                <input className="input-field" disabled value={data.amount ? `${formatEuro(data.amount)} / mois` : '—'} style={{ opacity: 0.6 }} />
              </div>
            </>
          ) : (
            <div>
              <label className="label">Montant mensuel (€)</label>
              <input className="input-field" type="number" step="0.01" required value={data.amount} onChange={e => setData(p => ({ ...p, amount: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">Compte de prélèvement</label>
            <select className="input-field" value={data.accountId} onChange={e => setData(p => ({ ...p, accountId: e.target.value }))}>
              {availAcc.map(a => <option key={a.id} value={a.id}>{a.name} ({a.visibility === 'shared' ? 'Commun' : 'Perso'})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Répartition</label>
            <select className="input-field" value={data.distributionType} onChange={e => setData(p => ({ ...p, distributionType: e.target.value }))}>
              <option value="prorata">Prorata des salaires</option>
              <option value="50_50">50 / 50</option>
              <option value="custom">Pourcentage (%)</option>
              <option value="custom_amount">Montant fixe (€)</option>
              <option value="hybrid">Hybride (Fixe + Prorata)</option>
            </select>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
              <button type="button" className="btn-small" style={{ flex: 1, background: '#f3e8ff', color: '#a855f7' }}
                onClick={() => {
                  const pct = {}; const amt = {};
                  settings.members.forEach(m => { pct[m.id] = m.id === uid ? 100 : 0; amt[m.id] = m.id === uid ? Number(data.amount) : 0; });
                  setData(p => ({ ...p, distributionType: 'custom', customPercentages: pct, customAmounts: amt }));
                }}>Tout moi</button>
              <button type="button" className="btn-small" style={{ flex: 1 }}
                onClick={() => {
                  const other = settings.members.find(m => m.id !== uid);
                  if (!other) return;
                  const pct = {}; const amt = {};
                  settings.members.forEach(m => { pct[m.id] = m.id === other.id ? 100 : 0; amt[m.id] = m.id === other.id ? Number(data.amount) : 0; });
                  setData(p => ({ ...p, distributionType: 'custom', customPercentages: pct, customAmounts: amt }));
                }}>Tout l'autre</button>
            </div>
          </div>
          <div>
            <label className="label">Jour de prélèvement (1–31)</label>
            <input className="input-field" type="number" min="1" max="31" value={data.dueDate}
              onChange={e => setData(p => ({ ...p, dueDate: Number(e.target.value) }))} />
          </div>

          {data.distributionType === 'custom' && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--bg-subtle)', padding: '0.875rem', borderRadius: 'var(--radius-md)' }}>
              <label className="label">Pourcentages (%)</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                {settings.members.map(m => (
                  <div key={m.id} style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{m.name}</span>
                    <input className="input-field" type="number" value={data.customPercentages[m.id] ?? ''}
                      onChange={e => setData(p => ({ ...p, customPercentages: { ...p.customPercentages, [m.id]: Number(e.target.value) } }))} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {(data.distributionType === 'custom_amount' || data.distributionType === 'hybrid') && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--bg-subtle)', padding: '0.875rem', borderRadius: 'var(--radius-md)' }}>
              <label className="label">{data.distributionType === 'hybrid' ? 'Part fixe (€) — le reste au prorata' : 'Montants fixes (€)'}</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                {settings.members.map(m => (
                  <div key={m.id} style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{m.name}</span>
                    <input className="input-field" type="number" step="0.01" value={data.customAmounts[m.id] ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        const newAmts = { ...data.customAmounts, [m.id]: val };
                        if (settings.members.length === 2 && data.amount && data.distributionType === 'custom_amount') {
                          const other = settings.members.find(x => x.id !== m.id);
                          if (other) newAmts[other.id] = (Number(data.amount) - Number(val)).toFixed(2);
                        }
                        setData(p => ({ ...p, customAmounts: newAmts }));
                      }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ gridColumn: '1 / -1' }}>
            <DistributionPreview amount={data.amount} type={data.distributionType} customPct={data.customPercentages} customAmts={data.customAmounts} settings={settings} calcDist2={calcDist2} />
          </div>
        </div>
        <div className={isModal ? "modal-footer" : ""} style={!isModal ? { padding: '1.25rem', borderTop: '1px solid var(--border-solid)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' } : { display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
          <button type="button" onClick={onCancel} className="btn" style={{ border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', background: 'transparent', minWidth: '100px' }}>Annuler</button>
          <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>Enregistrer</button>
        </div>
      </form>
    </div>
  );

  if (isModal) return formContent;

  return (
    <div className="card animate-fade-in" style={{ marginBottom: '1.5rem', border: '2px solid var(--primary)', padding: 0, overflow: 'hidden' }}>
      {formContent}
    </div>
  );
};

const Charges = ({ householdId }) => {
  const uid = auth.currentUser?.uid;
  const { charges: allCharges, salaries, settings, loading } = useHouseholdData(householdId);
  const { confirm, alert } = useConfirm();

  const startDay = settings?.accountStartDay || 1;
  const now = new Date();
  const { year: nowYear, month: nowMonth } = getAccountingMonth(now, startDay);

  const [offset, setOffset] = useState(0);
  const { year: selectedYear, month: selectedMonth } = useMemo(
    () => shiftAccountingMonth(nowYear, nowMonth, offset), [nowYear, nowMonth, offset]
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);
  const [newCharge, setNewCharge] = useState(emptyCharge);

  // Charges filtrées et visibles pour le mois sélectionné
  const charges = useMemo(() => {
    if (!settings) return [];
    return allCharges.filter(c =>
      isChargeVisibleTo(c, uid) &&
      isChargeActiveInMonth(c, selectedYear, selectedMonth)
    );
  }, [allCharges, uid, selectedYear, selectedMonth, settings]);

  const mSal = useMemo(() => findSalariesForMonth(salaries, selectedYear, selectedMonth), [salaries, selectedYear, selectedMonth]);

  const calcDist2 = (amount, type, customPct = {}, customAmts = {}) => {
    if (!settings?.members || !amount) return {};
    return calcDist(amount, type, settings.members, mSal?.salaries || {}, customPct, customAmts, salaries, new Date(selectedYear, selectedMonth, 15));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!uid || !householdId) return;
    const selectedAcc = settings?.accounts?.find(a => a.id === newCharge.accountId);
    const dist = calcDist2(newCharge.amount, newCharge.distributionType, newCharge.customPercentages, newCharge.customAmounts);
    const myShare = dist[uid] || 0;
    const isFullyMe = Math.abs(myShare - Number(newCharge.amount)) < 0.01;
    const currentMonthStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;
    const payload = {
      ...newCharge, amount: Number(newCharge.amount),
      validFrom: currentMonthStr, validTo: null,
      visibility: isFullyMe ? uid : (selectedAcc?.visibility || 'shared'),
      distribution: dist,
    };
    await addCharge(householdId, uid, payload);
    // onSnapshot rafraîchit automatiquement
    setShowAddForm(false);
    setNewCharge(emptyCharge);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!uid || !editingCharge?.id) return;
    const currentMonthStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;
    const dist = calcDist2(editingCharge.amount, editingCharge.distributionType, editingCharge.customPercentages, editingCharge.customAmounts);
    const myShare = dist[uid] || 0;
    const isFullyMe = Math.abs(myShare - Number(editingCharge.amount)) < 0.01;
    const selectedAcc = settings?.accounts?.find(a => a.id === editingCharge.accountId);

    const needsNewVersion = editingCharge.validFrom !== currentMonthStr;
    const updates = {
      ...editingCharge, amount: Number(editingCharge.amount),
      distribution: dist,
      visibility: isFullyMe ? uid : (selectedAcc?.visibility || 'shared'),
    };
    delete updates.id;

    if (needsNewVersion) {
      const doNewVersion = await confirm({
        title: 'Mise à jour de la charge',
        message: 'Créer une nouvelle version à partir de ce mois ? (recommandé pour conserver l\'historique)',
        confirmText: 'Nouvelle version', cancelText: 'Modifier l\'historique', variant: 'info',
      });
      if (doNewVersion) {
        const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
        const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
        await updateCharge(householdId, editingCharge.id, { validTo: prevMonthStr });
        await addCharge(householdId, uid, { ...updates, validFrom: currentMonthStr, validTo: null });
        setEditingCharge(null); return;
      }
    }
    await updateCharge(householdId, editingCharge.id, updates);
    setEditingCharge(null);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer cette charge ?',
      message: 'Supprime la charge pour tous les mois futurs.',
      variant: 'danger', confirmText: 'Supprimer', cancelText: 'Annuler',
    });
    if (ok) await deleteCharge(householdId, id);
  };

  const getAccountName = (id) => settings?.accounts?.find(a => a.id === id)?.name || '—';

  const monthLabel = formatAccountingMonthLabel(selectedYear, selectedMonth, startDay).replace(/^\w/, c => c.toUpperCase());

  // Init form quand settings arrive
  const initNewCharge = () => {
    const currentMonthStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;
    const availAcc = settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === uid) || [];
    const initPct = {}; const initAmt = {};
    settings?.members?.forEach(m => { initPct[m.id] = 50; initAmt[m.id] = 0; });
    setNewCharge({ ...emptyCharge, accountId: availAcc[0]?.id || '', customPercentages: initPct, customAmounts: initAmt, validFrom: currentMonthStr });
    setShowAddForm(true);
  };

  if (loading) return <ListPageSkeleton rows={5} />;



  return (
    <div className="page-container animate-fade-in">
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '400', letterSpacing: '-0.3px', marginBottom: '0.15rem' }}>Charges fixes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Abonnements & prélèvements réguliers</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem', gap: '0.4rem' }}
          onClick={() => showAddForm ? setShowAddForm(false) : initNewCharge()}>
          <Plus size={15} style={{ transform: showAddForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.25s' }} />
          {showAddForm ? 'Annuler' : 'Nouvelle charge'}
        </button>
      </header>

      <div className="month-nav">
        <button style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setOffset(o => o - 1)}><ChevronLeft size={22} /></button>
        <h2 className="month-nav-title">{monthLabel}</h2>
        <button style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setOffset(o => o + 1)}><ChevronRight size={22} /></button>
      </div>

      {showAddForm && (
        <ChargeForm data={newCharge} setData={setNewCharge} onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} title="Nouvelle charge fixe" settings={settings} uid={uid} calcDist2={calcDist2} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {charges.map(charge => {
          const isViewing = viewingId === charge.id;
          const catCfg = getCategoryConfig(charge.category);
          const prog = charge.frequency === 'annual' ? getAnnualChargeProgress(charge, selectedYear, selectedMonth) : null;

          return (
            <div key={charge.id}>
              <div className="card" style={{ cursor: 'pointer', padding: '1rem 1.25rem', borderBottomLeftRadius: isViewing ? 0 : undefined, borderBottomRightRadius: isViewing ? 0 : undefined, boxShadow: isViewing ? 'none' : undefined, borderBottom: isViewing ? 'none' : undefined }}
                onClick={() => setViewingId(isViewing ? null : charge.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.3rem' }}>{charge.name}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '600', background: catCfg.bg, color: catCfg.color }}>
                        {React.createElement(catCfg.icon, { size: 11 })} {charge.category || 'Autre'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Le {charge.dueDate || 1} · {getAccountName(charge.accountId)}
                      </span>
                      {charge.frequency === 'annual' && <span className="dist-badge">Annuelle</span>}
                    </div>
                    {prog && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ height: '4px', background: 'var(--border-solid)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.2rem' }}>
                          <div style={{ height: '100%', width: `${prog.progressPct}%`, background: prog.progressPct >= 100 ? 'var(--success)' : prog.isDueThisMonth ? 'var(--danger)' : 'var(--primary)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: prog.isDueThisMonth ? 'var(--danger)' : prog.monthsUntilDue === 1 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: '600' }}>
                          {formatEuro(prog.provisioned, false)} / {formatEuro(prog.total, false)}
                          {prog.isDueThisMonth && ' · ⚠ Échéance ce mois'}
                          {prog.monthsUntilDue === 1 && !prog.isDueThisMonth && ' · Échéance le mois prochain'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--primary)' }}>{formatEuro(charge.amount)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatDistributionLabel(charge.distributionType, charge.customPercentages, charge.customAmounts, settings?.members)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Détail accordéon enrichi */}
              {isViewing && (
                <div className="accordion-content">
                  <div className="info-grid">
                    
                    {/* Col 1: Répartition */}
                    <div className="info-block">
                      <p className="info-header"><PieChart size={12} /> Répartition</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {settings?.members?.map(m => {
                          const dist = calcDist2(charge.amount, charge.distributionType, charge.customPercentages, charge.customAmounts);
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatEuro(dist[m.id])}</span>
                            </div>
                          );
                        })}
                      </div>

                      {prog && (
                        <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-solid)' }}>
                          <p style={{ fontWeight: '800', fontSize: '0.65rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <RefreshCw size={12} /> Provision annuelle
                          </p>
                           {[
                             { l: 'Total annuel', v: formatEuro(prog.total) },
                             { l: 'Provisionné', v: formatEuro(prog.provisioned), c: 'var(--success)' },
                             { l: 'Reste', v: formatEuro(prog.remaining), c: prog.remaining > 0 ? 'var(--warning)' : 'var(--success)' },
                             { l: 'Échéance', v: charge.annualDueDate || '—' },
                          ].map(({ l, v, c }) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                              <span style={{ fontWeight: '700', color: c }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Col 2: Configuration */}
                    <div className="info-block">
                      <p className="info-header"><Info size={12} /> Configuration</p>
                      
                      <div className="info-item">
                        <Landmark size={14} className="info-item-icon" />
                        <div className="info-item-content">
                          <span className="info-label">Compte</span>
                          <span className="info-value">{getAccountName(charge.accountId)}</span>
                        </div>
                      </div>

                      <div className="info-item">
                        <RefreshCw size={14} className="info-item-icon" />
                        <div className="info-item-content">
                          <span className="info-label">Fréquence</span>
                          <span className="info-value">{charge.frequency === 'annual' ? 'Annuelle (lissée)' : 'Mensuelle'}</span>
                        </div>
                      </div>

                      <div className="info-item">
                        <PieChart size={14} className="info-item-icon" />
                        <div className="info-item-content">
                          <span className="info-label">Répartition</span>
                          <span className="info-value">{formatDistributionLabel(charge.distributionType, charge.customPercentages, charge.customAmounts, settings?.members)}</span>
                        </div>
                      </div>

                      <div className="info-item">
                        <Calendar size={14} className="info-item-icon" />
                        <div className="info-item-content">
                          <span className="info-label">Échéance</span>
                          <span className="info-value">Le {charge.dueDate || 1} du mois</span>
                        </div>
                      </div>

                      <div className="info-item">
                        <Eye size={14} className="info-item-icon" />
                        <div className="info-item-content">
                          <span className="info-label">Visibilité</span>
                          <span className="info-value">{charge.visibility === 'shared' ? 'Foyer' : 'Personnel'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-solid)' }}>
                        <button className="btn" style={{ flex: 1, border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', background: 'transparent', fontSize: '0.85rem' }}
                          onClick={e => { e.stopPropagation(); setEditingCharge({ ...charge }); setViewingId(null); }}>
                          <Edit2 size={15} style={{ marginRight: '5px' }} /> Modifier
                        </button>
                        <button className="btn" style={{ flex: 1, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.85rem' }}
                          onClick={e => { e.stopPropagation(); handleDelete(charge.id); setViewingId(null); }}>
                          <Trash2 size={15} style={{ marginRight: '5px' }} /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {charges.length === 0 && !showAddForm && (
          <div className="empty-state">
            <p style={{ fontWeight: '700', marginBottom: '0.35rem' }}>Aucune charge pour ce mois</p>
            <p style={{ fontSize: '0.85rem' }}>Ajoutez vos prélèvements récurrents.</p>
          </div>
        )}
      </div>

      {/* Modal modification */}
      {editingCharge && (
        <div className="modal-overlay" onClick={() => setEditingCharge(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <ChargeForm
              data={editingCharge} setData={setEditingCharge}
              onSubmit={handleUpdate} onCancel={() => setEditingCharge(null)}
              title="Modifier la charge"
              settings={settings} uid={uid} calcDist2={calcDist2}
              isModal={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Charges;
