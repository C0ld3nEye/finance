import React, { useState, useMemo } from 'react';
import { addExpense, updateExpense, deleteExpense, isExpenseVisibleTo } from '../services/expenses';
import { useHouseholdData } from '../hooks/useHouseholdData';
import { isInAccountingMonth, getAccountingMonth, shiftAccountingMonth, formatAccountingMonthLabel } from '../utils/monthUtils';
import { findSalariesForMonth } from '../services/salaries';
import { pb } from '../config/pocketbase';
import { Plus, Trash2, ChevronLeft, ChevronRight, Edit2, X, Landmark, PieChart, Eye, User, Calendar, Info } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { CATEGORIES, getCategoryConfig } from '../constants/categories';
import { calculateDistribution as calcDist, formatEuro, formatDistributionLabel } from '../utils/finance';
import { ListPageSkeleton } from '../components/SkeletonLoader';



const emptyExpense = {
  description: '', amount: '', date: new Date().toISOString().slice(0, 10),
  category: 'Alimentation', paidBy: '', accountId: '',
  visibility: 'shared', distributionType: '50_50',
  customPercentages: {}, customAmounts: {},
};
const DistPreview = ({ amount, type, customPct, customAmts, settings, calcDist2 }) => {
  if (!amount || !settings?.members) return null;
  const dist = calcDist2(amount, type, customPct, customAmts);
  return (
    <div style={{ background: 'var(--primary-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.8rem' }}>Répartition :</span>
      {settings.members.map(m => (
        <span key={m.id} style={{ fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{m.name} : </span>
          <span style={{ fontWeight: '700' }}>{formatEuro(dist[m.id])}</span>
        </span>
      ))}
    </div>
  );
};

const DistFields = ({ data, setData, settings }) => (
  <>
    {data.distributionType === 'custom' && (
      <div style={{ gridColumn: '1 / -1', background: 'var(--bg-subtle)', padding: '0.875rem', borderRadius: 'var(--radius-md)' }}>
        <label className="label">Pourcentages (%)</label>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          {settings.members.map(m => (
            <div key={m.id} style={{ flex: 1 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{m.name}</span>
              <input className="input-field" type="number" value={data.customPercentages[m.id] ?? ''}
                onChange={e => setData(p => ({ ...p, customPercentages: { ...p.customPercentages, [m.id]: Number(e.target.value) } }))} />
            </div>
          ))}
        </div>
      </div>
    )}
    {(data.distributionType === 'custom_amount' || data.distributionType === 'hybrid') && (
      <div style={{ gridColumn: '1 / -1', background: 'var(--bg-subtle)', padding: '0.875rem', borderRadius: 'var(--radius-md)' }}>
        <label className="label">{data.distributionType === 'hybrid' ? 'Part fixe (€) — reste au prorata' : 'Montants fixes (€)'}</label>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          {settings.members.map(m => (
            <div key={m.id} style={{ flex: 1 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{m.name}</span>
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
  </>
);

const ExpenseForm = ({ data, setData, onSubmit, onCancel, title, settings, uid, calcDist2, isModal = false }) => {
  const availAcc = settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === uid) || [];
  
  const formContent = (
    <div className={isModal ? "flex-col-1 overflow-hidden" : ""}>
      <div className={isModal ? "modal-header" : ""} style={!isModal ? { padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-solid)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)' } : {}}>
        <h3 style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>{title}</h3>
        <button type="button" onClick={onCancel} style={{ color: 'var(--text-muted)', padding: '0.5rem' }}><X size={22} /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className={isModal ? "modal-body" : ""} style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', padding: !isModal ? '1.5rem' : undefined }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Description</label>
            <input className="input-field" required placeholder="ex : Courses Leclerc" value={data.description}
              onChange={e => setData(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Montant (€)</label>
            <input className="input-field" type="number" step="0.01" required value={data.amount}
              onChange={e => setData(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input-field" type="date" required value={data.date}
              onChange={e => setData(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input-field" value={data.category} onChange={e => setData(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payé par</label>
            <select className="input-field" value={data.paidBy} onChange={e => setData(p => ({ ...p, paidBy: e.target.value }))}>
              {settings?.members?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Compte</label>
            <select className="input-field" value={data.accountId} onChange={e => setData(p => ({ ...p, accountId: e.target.value }))}>
              {availAcc.map(a => <option key={a.id} value={a.id}>{a.name} ({a.visibility === 'shared' ? 'Commun' : 'Perso'})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Répartition</label>
            <select className="input-field" value={data.distributionType} onChange={e => setData(p => ({ ...p, distributionType: e.target.value }))}>
              <option value="50_50">50 / 50</option>
              <option value="prorata">Prorata des salaires</option>
              <option value="custom">Pourcentage (%)</option>
              <option value="custom_amount">Montant fixe (€)</option>
              <option value="hybrid">Hybride (Fixe + Prorata)</option>
            </select>
          </div>
          <DistFields data={data} setData={setData} settings={settings} />
          <div style={{ gridColumn: '1 / -1' }}>
            <DistPreview amount={data.amount} type={data.distributionType} customPct={data.customPercentages} customAmts={data.customAmounts} settings={settings} calcDist2={calcDist2} />
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

const Expenses = ({ householdId }) => {
  const uid = pb.authStore.model?.id;
  const { expenses: allExpenses, salaries, settings, loading } = useHouseholdData(householdId);
  const { confirm } = useConfirm();

  const startDay = settings?.accountStartDay || 1;
  const now = new Date();
  const { year: nowYear, month: nowMonth } = getAccountingMonth(now, startDay);

  const [offset, setOffset] = useState(0);
  const { year: selectedYear, month: selectedMonth } = useMemo(
    () => shiftAccountingMonth(nowYear, nowMonth, offset), [nowYear, nowMonth, offset]
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [newExpense, setNewExpense] = useState(emptyExpense);

  // Dépenses filtrées pour le mois comptable sélectionné
  const expenses = useMemo(() => {
    if (!settings) return [];
    return allExpenses
      .filter(e =>
        isExpenseVisibleTo(e, uid) &&
        isInAccountingMonth(e.date || e.createdAt, selectedYear, selectedMonth, startDay)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allExpenses, uid, selectedYear, selectedMonth, startDay, settings]);

  const mSal = useMemo(() => findSalariesForMonth(salaries, selectedYear, selectedMonth), [salaries, selectedYear, selectedMonth]);

  const calcDist2 = (amount, type, customPct = {}, customAmts = {}) => {
    if (!settings?.members || !amount) return {};
    return calcDist(amount, type, settings.members, mSal?.salaries || {}, customPct, customAmts, salaries, new Date(selectedYear, selectedMonth, 15));
  };

  const resolveVisibility = (dist, amount, fallback) => {
    const myShare = dist[uid] || 0;
    const hasOther = Object.entries(dist).some(([id, v]) => id !== uid && v > 0.01);
    if (hasOther) return 'shared';
    if (Math.abs(myShare - Number(amount)) < 0.01) return uid;
    return fallback || 'shared';
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!uid || !householdId) return;
    const dist = calcDist2(newExpense.amount, newExpense.distributionType, newExpense.customPercentages, newExpense.customAmounts);
    const expDate = new Date(newExpense.date);
    expDate.setMinutes(expDate.getMinutes() + expDate.getTimezoneOffset());
    const payload = {
      ...newExpense, amount: Number(newExpense.amount),
      date: expDate.toISOString(),
      distribution: dist,
      visibility: resolveVisibility(dist, newExpense.amount, newExpense.visibility),
    };
    await addExpense(householdId, uid, payload);
    setShowAddForm(false);
    setNewExpense(prev => ({ ...prev, description: '', amount: '' }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!uid || !editingExpense?.id) return;
    const dist = calcDist2(editingExpense.amount, editingExpense.distributionType, editingExpense.customPercentages, editingExpense.customAmounts);
    const expDate = new Date(editingExpense.date);
    expDate.setMinutes(expDate.getMinutes() + expDate.getTimezoneOffset());
    const updates = {
      ...editingExpense, amount: Number(editingExpense.amount),
      date: expDate.toISOString(), distribution: dist,
      visibility: resolveVisibility(dist, editingExpense.amount, editingExpense.visibility),
    };
    delete updates.id;
    await updateExpense(householdId, editingExpense.id, updates);
    setEditingExpense(null);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Supprimer la dépense ?', message: 'Action irréversible.', variant: 'danger', confirmText: 'Supprimer', cancelText: 'Annuler' });
    if (ok) await deleteExpense(householdId, id);
  };

  const initNewExpense = () => {
    const availAcc = settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === uid) || [];
    const initPct = {}; const initAmt = {};
    settings?.members?.forEach(m => { initPct[m.id] = 50; initAmt[m.id] = 0; });
    setNewExpense({
      ...emptyExpense,
      paidBy: uid || settings?.members?.[0]?.id || '',
      accountId: availAcc[0]?.id || '',
      customPercentages: initPct,
      customAmounts: initAmt,
    });
    setShowAddForm(true);
  };

  const totalMonth = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const monthLabel = formatAccountingMonthLabel(selectedYear, selectedMonth, startDay).replace(/^\w/, c => c.toUpperCase());
  const getAccName = (id) => settings?.accounts?.find(a => a.id === id)?.name || '—';
  const getMemName = (id) => settings?.members?.find(m => m.id === id)?.name || '—';



  if (loading) return <ListPageSkeleton rows={5} />;

  const byDate = expenses.reduce((acc, e) => {
    const day = e.date ? new Date(e.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date inconnue';
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  return (
    <div className="page-container animate-fade-in">
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '400', letterSpacing: '-0.3px', marginBottom: '0.15rem' }}>Dépenses</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Historique des dépenses courantes</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem', gap: '0.4rem' }}
          onClick={() => showAddForm ? setShowAddForm(false) : initNewExpense()}>
          <Plus size={15} style={{ transform: showAddForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.25s' }} />
          {showAddForm ? 'Annuler' : 'Nouvelle dépense'}
        </button>
      </header>

      <div className="month-nav">
        <button style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setOffset(o => o - 1)}><ChevronLeft size={22} /></button>
        <h2 className="month-nav-title">{monthLabel}</h2>
        <button style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setOffset(o => o + 1)}><ChevronRight size={22} /></button>
      </div>

      {/* Récap mois */}
      {expenses.length > 0 && (
        <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label" style={{ margin: 0 }}>{expenses.length} dépense{expenses.length > 1 ? 's' : ''} ce mois</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--primary)' }}>{formatEuro(totalMonth)}</span>
        </div>
      )}

      {showAddForm && (
        <ExpenseForm data={newExpense} setData={setNewExpense} onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} title="Nouvelle dépense" settings={settings} uid={uid} calcDist2={calcDist2} />
      )}

      {/* Liste groupée par jour */}
      {Object.keys(byDate).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {Object.entries(byDate).map(([day, items]) => (
            <div key={day}>
              <h3 style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem', marginLeft: '0.5rem' }}>
                {day}
              </h3>
              <div className="card" style={{ padding: '0.25rem 0' }}>
                {items.map((exp, i) => {
                  const dist = calcDist2(exp.amount, exp.distributionType, exp.customPercentages, exp.customAmounts);
                  const isViewing = viewingId === exp.id;
                  const CategoryIcon = getCategoryConfig(exp.category).icon;

                  return (
                    <div key={exp.id}>
                      <div style={{ padding: '0.75rem 1.1rem', cursor: 'pointer' }} onClick={() => setViewingId(isViewing ? null : exp.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1, paddingRight: '1rem', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <CategoryIcon size={16} color="var(--text-secondary)" />
                              <span style={{ fontWeight: '600' }}>{exp.description}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {getAccName(exp.accountId)} · Payé par {getMemName(exp.paidBy)}
                              </span>
                            </div>
                            
                            {/* Détails accordéon enrichis */}
                            {isViewing && (
                              <div style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-solid)', padding: '1.25rem 1.5rem', marginTop: '0.5rem' }}>
                                <div className="info-grid">
                                  
                                  {/* Col 1: Répartition */}
                                  <div className="info-block">
                                    <p className="info-header"><PieChart size={12} /> Répartition</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                      {settings?.members?.map(m => (
                                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatEuro(dist[m.id])}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Col 2: Info Technique */}
                                  <div className="info-block">
                                    <p className="info-header"><Info size={12} /> Détails</p>
                                    <div className="info-item">
                                      <Landmark size={13} className="info-item-icon" />
                                      <div className="info-item-content">
                                        <span className="info-label">Compte</span>
                                        <span className="info-value">{getAccName(exp.accountId)}</span>
                                      </div>
                                    </div>
                                    <div className="info-item">
                                      <PieChart size={13} className="info-item-icon" />
                                      <div className="info-item-content">
                                        <span className="info-label">Répartition</span>
                                        <span className="info-value">{formatDistributionLabel(exp.distributionType, exp.customPercentages, exp.customAmounts, settings?.members)}</span>
                                      </div>
                                    </div>
                                    <div className="info-item">
                                      <Eye size={13} className="info-item-icon" />
                                      <div className="info-item-content">
                                        <span className="info-label">Visibilité</span>
                                        <span className="info-value">{exp.visibility === 'shared' ? 'Foyer' : 'Personnel'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Col 3: Historique */}
                                  <div className="info-block">
                                    <p className="info-header"><Calendar size={12} /> Historique</p>
                                    <div className="info-item">
                                      <User size={13} className="info-item-icon" />
                                      <div className="info-item-content">
                                        <span className="info-label">Saisie par</span>
                                        <span className="info-value">{getMemName(exp.userId || exp.createdBy)}</span>
                                      </div>
                                    </div>
                                    <div className="info-item">
                                      <Calendar size={13} className="info-item-icon" />
                                      <div className="info-item-content">
                                        <span className="info-label">Date</span>
                                        <span className="info-value">{new Date(exp.date || exp.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-solid)' }}>
                                  <button className="btn" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', border: '1px solid var(--border-solid)', background: 'transparent' }} 
                                    onClick={e => { e.stopPropagation(); setEditingExpense({ ...exp, date: exp.date?.slice(0, 10) || '' }); setViewingId(null); }}>
                                    <Edit2 size={14} style={{ marginRight: '5px' }} /> Modifier
                                  </button>
                                  <button className="btn" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', background: 'var(--danger-light)', color: 'var(--danger)' }}
                                    onClick={e => { e.stopPropagation(); handleDelete(exp.id); setViewingId(null); }}>
                                    <Trash2 size={14} style={{ marginRight: '5px' }} /> Supprimer
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--primary)', flexShrink: 0 }}>
                            {formatEuro(exp.amount)}
                          </span>
                        </div>
                      </div>
                      {i < items.length - 1 && <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 1.1rem' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : !showAddForm && (
        <div className="empty-state">
          <p style={{ fontWeight: '700', marginBottom: '0.35rem' }}>Aucune dépense ce mois</p>
          <p style={{ fontSize: '0.85rem' }}>Ajoutez votre première dépense.</p>
        </div>
      )}

      {editingExpense && (
        <div className="modal-overlay" onClick={() => setEditingExpense(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <ExpenseForm 
              data={editingExpense} setData={setEditingExpense} 
              onSubmit={handleUpdate} onCancel={() => setEditingExpense(null)} 
              title="Modifier la dépense" 
              settings={settings} uid={uid} calcDist2={calcDist2} 
              isModal={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
