import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getExpensesByMonth, addExpense, deleteExpense, updateExpense } from '../services/expenses';
import { getMonthlySalaries } from '../services/salaries';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getSettings } from '../services/settings';
import { auth } from '../config/firebase';
import { 
  Plus, Trash2, ChevronLeft, ChevronRight, Calendar, Tag, Users, Lock, Edit2, X,
  ShoppingBag, Home, Car, Gamepad2, HeartPulse, Smartphone, Tv, Gift, Dumbbell, Dog, ShieldCheck, Landmark, MoreHorizontal
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

import { CATEGORY_CONFIG, CATEGORIES, getCategoryConfig } from '../constants/categories';
import { calculateDistribution as calcDist } from '../utils/finance';

const Expenses = ({ householdId }) => {
  const [searchParams] = useSearchParams();
  const initialDate = (() => {
    const y = searchParams.get('year');
    const m = searchParams.get('month');
    if (y && m) return new Date(Number(y), Number(m), 1);
    return new Date();
  })();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [monthlySalaries, setMonthlySalaries] = useState(null);
  const [loading, setLoading] = useState(true);
  const { confirm } = useConfirm();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Alimentation',
    paidBy: '',
    accountId: '',
    visibility: 'shared',
    distributionType: '50_50',
    customPercentages: {},
    customAmounts: {}
  });

  const categories = Object.keys(CATEGORY_CONFIG);

  useEffect(() => {
    fetchData(currentDate);
  }, [currentDate, householdId]);

  const fetchData = async (date) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId) return;
    setLoading(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const [expensesData, settingsData, mSalaries] = await Promise.all([
        getExpensesByMonth(householdId, uid, year, month),
        getSettings(householdId),
        getMonthlySalaries(householdId, year, month)
      ]);
      setExpenses(expensesData);
      setSettings(settingsData);
      setMonthlySalaries(mSalaries);
      
      // Auto-select first member and first account if not set
      // Only show shared accounts + mine
      const availableAccounts = settingsData?.accounts.filter(a => a.visibility === 'shared' || a.ownerId === uid) || [];
      
      setNewExpense(prev => ({ 
        ...prev, 
        paidBy: prev.paidBy || (settingsData?.members?.[0]?.id || ''),
        accountId: prev.accountId || (availableAccounts[0]?.id || '')
      }));
    } catch (error) {
      console.error("Error loading expenses", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Wrapper autour de l'utilitaire centralisé : utilise les salaires mensuels (prioritaires sur les salaires statiques)
  const calculateDistribution = (amount, type, customDist = {}, customAmts = {}) => {
    if (!settings?.members) return {};
    return calcDist(
      amount,
      type,
      settings.members,
      monthlySalaries?.salaries || {},
      customDist,
      customAmts
    );
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId || !newExpense.description || !newExpense.amount || !newExpense.accountId) return;
    
    const selectedAccount = settings?.accounts?.find(a => a.id === newExpense.accountId);
    let finalExpense = { ...newExpense };

    // On utilise TOUJOURS la répartition choisie par l'utilisateur
    finalExpense.distribution = calculateDistribution(newExpense.amount, newExpense.distributionType, newExpense.customPercentages, newExpense.customAmounts);
    
    
    const expenseDate = new Date(newExpense.date);
    expenseDate.setMinutes(expenseDate.getMinutes() + expenseDate.getTimezoneOffset());
    
    const myShare = finalExpense.distribution?.[uid] || 0;
    const isFullyMe = Math.abs(myShare - Number(newExpense.amount)) < 0.01;
    const hasOtherShare = Object.entries(finalExpense.distribution).some(([mId, amount]) => mId !== uid && amount > 0.01);
    
    let visibility = newExpense.visibility;
    if (hasOtherShare) {
      visibility = 'shared';
    } else if (isFullyMe) {
      visibility = uid;
    }

    const expenseToSave = {
      ...finalExpense,
      amount: Number(newExpense.amount),
      date: expenseDate.toISOString(),
      visibility: visibility
    };
    
    
    try {
      const saved = await addExpense(householdId, uid, expenseToSave);
      const savedDate = new Date(saved.date);
      if (savedDate.getMonth() === currentDate.getMonth() && savedDate.getFullYear() === currentDate.getFullYear()) {
         setExpenses([saved, ...expenses].sort((a,b) => new Date(b.date) - new Date(a.date)));
      }
      setShowAddForm(false);
      setNewExpense({ ...newExpense, description: '', amount: '' });
    } catch (error) {
      console.error("Error adding expense", error);
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Supprimer la dépense ?',
      message: 'Cette action est irréversible.',
      variant: 'danger',
      icon: 'delete',
      confirmText: 'Supprimer',
      cancelText: 'Annuler'
    });

    if (isConfirmed) {
      await deleteExpense(householdId, id);
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const handleViewClick = (expense) => {
    setViewingExpense(prev => (prev?.id === expense.id ? null : expense));
  };

  const handleEditFromView = () => {
    const expense = viewingExpense;
    setEditingExpense({
      ...expense,
      date: format(new Date(expense.date), 'yyyy-MM-dd')
    });
    setViewingExpense(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId || !editingExpense.id) return;

    let finalUpdates = { ...editingExpense };

    // Pas de forçage automatique de la visibilité sur l'ID utilisateur
    // L'utilisateur garde le contrôle total.
    // On s'assure juste que le compte par défaut est bien lié.
    finalUpdates.distribution = calculateDistribution(editingExpense.amount, editingExpense.distributionType, editingExpense.customPercentages, editingExpense.customAmounts);
    
    const expenseDate = new Date(editingExpense.date);
    expenseDate.setMinutes(expenseDate.getMinutes() + expenseDate.getTimezoneOffset());

    const myShare = finalUpdates.distribution?.[uid] || 0;
    const isFullyMe = Math.abs(myShare - Number(editingExpense.amount)) < 0.01;
    const hasOtherShare = Object.entries(finalUpdates.distribution).some(([mId, amount]) => mId !== uid && amount > 0.01);
    
    let visibility = editingExpense.visibility;
    if (hasOtherShare) {
      visibility = 'shared';
    } else if (isFullyMe) {
      visibility = uid;
    }

    const updates = {
      ...finalUpdates,
      amount: Number(editingExpense.amount),
      date: expenseDate.toISOString(),
      visibility: visibility
    };
    delete updates.id;

    try {
      await updateExpense(householdId, editingExpense.id, updates);
      setExpenses(expenses.map(exp => exp.id === editingExpense.id ? { ...editingExpense, ...updates } : exp));
      setEditingExpense(null);
    } catch (error) {
      console.error("Error updating expense", error);
    }
  };

  const getMemberName = (id) => {
    const mem = settings?.members?.find(m => m.id === id);
    return mem ? mem.name : 'Inconnu';
  };

  const getAccountName = (id) => {
    const acc = settings?.accounts?.find(a => a.id === id);
    return acc ? acc.name : 'Inconnu';
  };

  const totalMonth = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Dépenses Courantes</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Historique des dépenses mensuelles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={18} /> Nouvelle Dépense
        </button>
      </header>
      
      {/* Month Selector */}
      <div className="month-nav">
        <button onClick={handlePrevMonth} className="btn btn-outline" style={{ border: 'none' }}>
           <ChevronLeft size={24} />
        </button>
        <h2 className="month-nav-title">
          {format(currentDate, 'MMMM yyyy', { locale: fr })}
        </h2>
        <button onClick={handleNextMonth} className="btn btn-outline" style={{ border: 'none' }}>
           <ChevronRight size={24} />
        </button>
      </div>

      {showAddForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', border: '1px solid var(--primary-light)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Ajouter une Dépense</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Description / Libellé</label>
              <input type="text" className="input-field" required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="ex: Courses Leclerc" />
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input type="number" className="input-field" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input-field" required value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input-field" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Payé par</label>
              <select className="input-field" value={newExpense.paidBy} onChange={e => setNewExpense({...newExpense, paidBy: e.target.value})}>
                {settings?.members?.map(mem => (
                  <option key={mem.id} value={mem.id}>{mem.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Compte de prélèvement</label>
              <select className="input-field" value={newExpense.accountId} onChange={e => setNewExpense({...newExpense, accountId: e.target.value})}>
                {settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === auth.currentUser?.uid).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.visibility === 'shared' ? 'Commun' : 'Perso'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Répartition</label>
              <select className="input-field" value={newExpense.distributionType} onChange={e => setNewExpense({...newExpense, distributionType: e.target.value})}>
                <option value="50_50">50/50</option>
                <option value="prorata">Prorata</option>
                <option value="custom">Perso (%)</option>
                <option value="custom_amount">Montant (€)</option>
                <option value="hybrid">Hybride (Prorata + Fixe)</option>
              </select>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button type="button" className="btn-small" style={{ flex: 1, backgroundColor: '#f3e8ff', color: '#a855f7', border: '1px solid #f3e8ff' }} onClick={() => {
                  const me = settings.members.find(m => m.id === auth.currentUser.uid);
                  if (!me) { alert("⚠ Identifiez-vous d'abord dans les Paramètres (cliquez sur 'C'est moi')."); return; }
                  const distPct = {};
                  const distAmt = {};
                  settings.members.forEach(m => {
                    distPct[m.id] = (m.id === me.id ? 100 : 0);
                    distAmt[m.id] = (m.id === me.id ? Number(newExpense.amount) : 0);
                  });
                  setNewExpense({...newExpense, distributionType: 'custom', customPercentages: distPct, customAmounts: distAmt});
                }}>Moi</button>
                <button type="button" className="btn-small" style={{ flex: 1 }} onClick={() => {
                  const partner = settings.members.find(m => m.id !== auth.currentUser.uid);
                  const me = settings.members.find(m => m.id === auth.currentUser.uid);
                  const notMe = partner || settings.members.find(m => m.id !== me?.id);
                  if (notMe) {
                    const distPct = {};
                    const distAmt = {};
                    settings.members.forEach(m => {
                      distPct[m.id] = (m.id === notMe.id ? 100 : 0);
                      distAmt[m.id] = (m.id === notMe.id ? Number(newExpense.amount) : 0);
                    });
                    setNewExpense({...newExpense, distributionType: 'custom', customPercentages: distPct, customAmounts: distAmt});
                  }
                }}>L'autre</button>
              </div>
            </div>

             {newExpense.distributionType === 'custom' && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '1rem' }}>
                 {settings.members.map(m => (
                   <div key={m.id} style={{ flex: 1 }}>
                     <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.name} (%)</label>
                     <input type="number" className="input-field" value={newExpense.customPercentages[m.id] ?? ''} onChange={e => setNewExpense({...newExpense, customPercentages: {...newExpense.customPercentages, [m.id]: Number(e.target.value)}})} />
                   </div>
                 ))}
              </div>
            )}

            {newExpense.distributionType === 'custom_amount' && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="label" style={{ margin: 0 }}>Montants fixes (€)</label>
                  {Math.abs(settings.members.reduce((acc, m) => acc + Number(newExpense.customAmounts[m.id] || 0), 0) - Number(newExpense.amount)) > 0.01 && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                      ⚠ Total : {settings.members.reduce((acc, m) => acc + Number(newExpense.customAmounts[m.id] || 0), 0).toFixed(2)}€ ≠ {Number(newExpense.amount).toFixed(2)}€
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {settings.members.map(m => (
                    <div key={m.id} style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.name}</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        step="0.01"
                        value={newExpense.customAmounts[m.id] ?? ''} 
                        onChange={e => {
                          const val = e.target.value;
                          const newAmts = { ...newExpense.customAmounts, [m.id]: val };
                          if (settings.members.length === 2 && newExpense.amount) {
                            const otherMember = settings.members.find(mem => mem.id !== m.id);
                            if (otherMember) {
                              newAmts[otherMember.id] = (Number(newExpense.amount) - Number(val)).toFixed(2);
                            }
                          }
                          setNewExpense({...newExpense, customAmounts: newAmts});
                        }} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newExpense.distributionType === 'hybrid' && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <label className="label" style={{ marginBottom: '0.5rem' }}>Part fixe personnelle (€) <small style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>(Le reste sera au prorata)</small></label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {settings.members.map(m => (
                    <div key={m.id} style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.name}</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        step="0.01"
                        value={newExpense.customAmounts[m.id] ?? ''} 
                        onChange={e => setNewExpense({...newExpense, customAmounts: {...newExpense.customAmounts, [m.id]: e.target.value}})} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer Dépense</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {expenses.map((expense) => (
            <div key={expense.id} style={{ marginBottom: '0.5rem' }}>
              <div 
                className="card" 
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '1.25rem 1.5rem', 
                  borderBottom: viewingExpense?.id === expense.id ? 'none' : '1px solid var(--border-color)',
                  borderBottomLeftRadius: viewingExpense?.id === expense.id ? '0' : 'var(--radius-md)',
                  borderBottomRightRadius: viewingExpense?.id === expense.id ? '0' : 'var(--radius-md)',
                  transition: 'background-color 0.2s ease',
                  boxShadow: viewingExpense?.id === expense.id ? 'none' : 'var(--shadow-sm)'
                }} 
                onMouseOver={e => e.currentTarget.style.backgroundColor='var(--primary-light)'} 
                onMouseOut={e => e.currentTarget.style.backgroundColor='var(--surface-color)'}
                onClick={() => handleViewClick(expense)}
              >
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{format(new Date(expense.date), 'dd')}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{format(new Date(expense.date), 'MMM', { locale: fr })}</span>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-color)', height: '40px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{expense.description}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '10px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        backgroundColor: getCategoryConfig(expense.category).bg,
                        color: getCategoryConfig(expense.category).color
                      }}>
                        {React.createElement(getCategoryConfig(expense.category).icon, { size: 12 })} {expense.category || 'Autre'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>• {getMemberName(expense.paidBy)}</span>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.3rem',
                        color: expense.visibility === 'shared' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: '0.8rem'
                      }}>
                        {expense.visibility === 'shared' ? <Users size={12} /> : <Lock size={12} />}
                        {expense.visibility === 'shared' ? 'Foyer' : 'Perso'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{expense.amount.toFixed(2)} €</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {expense.distributionType === 'prorata' ? 'Prorata' : expense.distributionType === '50_50' ? '50/50' : expense.distributionType === 'hybrid' ? 'Hybride' : expense.distributionType === 'custom' ? 'Perso (%)' : 'Montants'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Détails Inline (Accordéon) */}
              {viewingExpense?.id === expense.id && (
                <div className="animate-slide-down" style={{ 
                  backgroundColor: 'var(--surface-color)', 
                  border: '1px solid var(--border-color)', 
                  borderTop: 'none',
                  borderBottomLeftRadius: 'var(--radius-md)',
                  borderBottomRightRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  marginTop: '-1px',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-color)' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Compte utilisé :</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{getAccountName(expense.accountId)}</span>
                      </p>
                      
                      <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--border-color)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Répartition : <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                            {expense.distributionType === 'prorata' ? 'Prorata des salaires' : 
                             expense.distributionType === '50_50' ? '50 / 50' : 
                             expense.distributionType === 'hybrid' ? 'Hybride (Fixe + Prorata)' : 
                             expense.distributionType === 'custom_amount' ? 'Montants fixes' : 'Pourcentage perso'}
                          </span>
                        </div>
                        
                        {(expense.distributionType === 'prorata' || expense.distributionType === 'hybrid') && (
                          <div style={{ fontSize: '0.72rem', backgroundColor: 'var(--primary-light)', padding: '0.5rem', borderRadius: '4px', color: 'var(--primary)' }}>
                            <strong>Base de calcul (Revenus du mois) :</strong><br/>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                              {settings?.members?.map(m => (
                                <span key={m.id}>{m.name} : {Number(monthlySalaries?.salaries?.[m.id] || m.salary || 0).toFixed(0)}€</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--primary)' }}>Détail des parts :</p>
                      {Object.entries(expense.distribution || {}).map(([mId, amount]) => {
                        const isHybrid = expense.distributionType === 'hybrid';
                        const fixedPart = Number(expense.customAmounts?.[mId] || 0);
                        const prorataPart = amount - fixedPart;

                        return (
                          <div key={mId} style={{ marginBottom: '0.6rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                              <span>{getMemberName(mId)}</span>
                              <span>{amount.toFixed(2)} €</span>
                            </div>
                            {isHybrid && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                                <span>Fixe: {fixedPart.toFixed(2)}€</span>
                                <span>+</span>
                                <span>Prorata: {prorataPart.toFixed(2)}€</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={(e) => { e.stopPropagation(); handleEditFromView(); }}
                      >
                        <Edit2 size={18} /> Modifier
                      </button>
                      <button 
                        className="btn" 
                        style={{ width: '100%', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); setViewingExpense(null); }}
                      >
                        <Trash2 size={18} /> Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {expenses.length === 0 && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Aucune dépense enregistrée pour ce mois.
            </div>
          )}
        </div>
      )}


      {/* Modal d'édition */}
      {editingExpense && (
        <div className="modal-overlay" onClick={() => setEditingExpense(null)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Modifier la Dépense</h2>
                <button className="btn btn-outline" style={{ padding: '0.5rem', border: 'none' }} onClick={() => setEditingExpense(null)}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label className="label">Description</label>
                    <input type="text" className="input-field" required value={editingExpense.description} onChange={e => setEditingExpense({...editingExpense, description: e.target.value})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">Montant (€)</label>
                      <input type="number" className="input-field" step="0.01" required value={editingExpense.amount} onChange={e => setEditingExpense({...editingExpense, amount: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input-field" required value={editingExpense.date} onChange={e => setEditingExpense({...editingExpense, date: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">Catégorie</label>
                      <select className="input-field" value={editingExpense.category} onChange={e => setEditingExpense({...editingExpense, category: e.target.value})}>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Payé par</label>
                      <select className="input-field" value={editingExpense.paidBy} onChange={e => setEditingExpense({...editingExpense, paidBy: e.target.value})}>
                        {settings?.members?.map(mem => (
                          <option key={mem.id} value={mem.id}>{mem.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">Compte</label>
                      <select className="input-field" value={editingExpense.accountId} onChange={e => setEditingExpense({...editingExpense, accountId: e.target.value})}>
                        {settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === auth.currentUser?.uid).map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.visibility === 'shared' ? 'Commun' : 'Perso'})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Répartition</label>
                       <select className="input-field" value={editingExpense.distributionType} onChange={e => {
                        const newType = e.target.value;
                        let updates = { distributionType: newType };
                        if (newType === 'custom_amount' && (!editingExpense.customAmounts || Object.keys(editingExpense.customAmounts).length === 0)) {
                          const currentDist = calculateDistribution(editingExpense.amount, editingExpense.distributionType, editingExpense.customPercentages, editingExpense.customAmounts);
                          updates.customAmounts = currentDist;
                        }
                        setEditingExpense({...editingExpense, ...updates});
                      }}>
                        <option value="50_50">50/50</option>
                        <option value="prorata">Prorata</option>
                        <option value="custom">Perso (%)</option>
                        <option value="custom_amount">Montant (€)</option>
                        <option value="hybrid">Hybride (Prorata + Fixe)</option>
                      </select>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                        <button type="button" className="btn-small" style={{ flex: 1, backgroundColor: '#f3e8ff', color: '#a855f7', border: '1px solid #f3e8ff' }} onClick={() => {
                          const dist = {};
                          settings.members.forEach(m => dist[m.id] = (m.id === auth.currentUser.uid ? 100 : 0));
                          setEditingExpense({...editingExpense, distributionType: 'custom', customPercentages: dist});
                        }}>Moi</button>
                        <button type="button" className="btn-small" style={{ flex: 1 }} onClick={() => {
                          const partner = settings.members.find(m => m.id !== auth.currentUser.uid);
                          if (partner) {
                            const dist = {};
                            settings.members.forEach(m => dist[m.id] = (m.id === partner.id ? 100 : 0));
                            setEditingExpense({...editingExpense, distributionType: 'custom', customPercentages: dist});
                          }
                        }}>L'autre</button>
                      </div>
                    </div>
                  </div>

                  {editingExpense.distributionType === 'custom' && (
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '1rem' }}>
                       {settings.members.map(m => (
                         <div key={m.id} style={{ flex: 1 }}>
                           <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.name} (%)</label>
                           <input type="number" className="input-field" value={editingExpense.customPercentages?.[m.id] || 0} onChange={e => setEditingExpense({...editingExpense, customPercentages: {...(editingExpense.customPercentages || {}), [m.id]: Number(e.target.value)}})} />
                         </div>
                       ))}
                    </div>
                  )}

                  {editingExpense.distributionType === 'custom_amount' && (
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label className="label" style={{ margin: 0 }}>Montants fixes (€)</label>
                        {Math.abs(settings.members.reduce((acc, m) => acc + Number(editingExpense.customAmounts?.[m.id] || 0), 0) - Number(editingExpense.amount)) > 0.01 && (
                          <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                            ⚠ Total incorrect
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        {settings.members.map(m => (
                          <div key={m.id} style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.name}</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              step="0.01"
                              value={editingExpense.customAmounts?.[m.id] || ''} 
                              onChange={e => {
                                const val = e.target.value;
                                const newAmts = { ...(editingExpense.customAmounts || {}), [m.id]: val };
                                if (settings.members.length === 2 && editingExpense.amount) {
                                  const otherMember = settings.members.find(mem => mem.id !== m.id);
                                  if (otherMember) {
                                    newAmts[otherMember.id] = (Number(editingExpense.amount) - Number(val)).toFixed(2);
                                  }
                                }
                                setEditingExpense({ ...editingExpense, customAmounts: newAmts });
                              }} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingExpense.distributionType === 'hybrid' && (
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <label className="label">Part fixe personnelle (€) <small style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>(Le reste sera au prorata)</small></label>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        {settings.members.map(m => (
                          <div key={m.id} style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.name}</span>
                            <input 
                              type="number" 
                              className="input-field" 
                              step="0.01"
                              value={editingExpense.customAmounts?.[m.id] || ''} 
                              onChange={e => setEditingExpense({
                                ...editingExpense, 
                                customAmounts: { ...(editingExpense.customAmounts || {}), [m.id]: e.target.value }
                              })} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingExpense(null)}>Annuler</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Sauvegarder</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
