import React, { useState, useEffect } from 'react';
import { getCharges, addCharge, deleteCharge, updateCharge, getAllCharges } from '../services/charges';
import { getSettings } from '../services/settings';
import { getMonthlySalaries } from '../services/salaries';
import { auth } from '../config/firebase';
import { 
  Plus, Trash2, PieChart, Users, Lock, Edit2, X, ChevronLeft, ChevronRight,
  ShoppingBag, Home, Car, Gamepad2, HeartPulse, Smartphone, Tv, Gift, Dumbbell, Dog, ShieldCheck, Landmark, MoreHorizontal
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

import { CATEGORY_CONFIG, CATEGORIES, getCategoryConfig } from '../constants/categories';

const Charges = ({ householdId }) => {
  const [charges, setCharges] = useState([]);
  const [settings, setSettings] = useState(null);
  const [monthlySalaries, setMonthlySalaries] = useState(null);
  const [loading, setLoading] = useState(true);
  const { confirm, alert } = useConfirm();

  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingCharge, setViewingCharge] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);
  const [newCharge, setNewCharge] = useState({
    name: '',
    amount: '',
    accountId: '',
    distributionType: 'prorata',
    customPercentages: {},
    customAmounts: {},
    visibility: 'shared',
    dueDate: 1,
    validFrom: `${selectedYear}-${(selectedMonth+1).toString().padStart(2, '0')}`,
    category: 'Alimentation',
    frequency: 'monthly',
    annualAmount: '',
    annualDueDate: ''
  });

  const categories = CATEGORIES;

  useEffect(() => {
    if (settings?.members && Object.keys(newCharge.customPercentages).length === 0) {
      const initialPercentages = {};
      settings.members.forEach(m => initialPercentages[m.id] = 50);
      setNewCharge(prev => ({ ...prev, customPercentages: initialPercentages }));
    }
  }, [settings]);

  useEffect(() => {
    fetchData();
  }, [householdId, currentDate]);

  const fetchData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId) return;
    try {
      const [allCharges, settingsData] = await Promise.all([
        getAllCharges(householdId, uid),
        getSettings(householdId)
      ]);

      const mSalaries = await getMonthlySalaries(householdId, selectedYear, selectedMonth);

      // Filtrer les charges actives pour le mois sélectionné
      const currentMonthStr = `${selectedYear}-${(selectedMonth+1).toString().padStart(2, '0')}`;
      const filtered = allCharges.filter(c => {
        const from = c.validFrom || '0000-01';
        const to = c.validTo || '9999-12';
        return currentMonthStr >= from && currentMonthStr <= to;
      });

      setCharges(filtered);
      setSettings(settingsData);
      setMonthlySalaries(mSalaries);
      
      const availableAccounts = settingsData?.accounts.filter(a => a.visibility === 'shared' || a.ownerId === uid) || [];
      if (availableAccounts.length > 0) {
        setNewCharge(prev => ({ ...prev, accountId: availableAccounts[0].id, validFrom: currentMonthStr }));
      }
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + delta);
    setCurrentDate(next);
  };

  const calculateDistribution = (amount, type, customDist = {}, customAmts = {}) => {
    if (!settings?.members || !amount || settings.members.length < 2) return {};
    const numAmount = Number(amount);
    const m1 = settings.members[0];
    const m2 = settings.members[1];
    
    if (type === '50_50') {
      return { [m1.id]: numAmount / 2, [m2.id]: numAmount / 2 };
    }
    if (type === 'prorata') {
      const s1 = monthlySalaries?.salaries?.[m1.id] || 0;
      const s2 = monthlySalaries?.salaries?.[m2.id] || 0;
      const totalSalary = s1 + s2;
      
      if (totalSalary === 0) return { [m1.id]: numAmount / 2, [m2.id]: numAmount / 2 };
      const m1Share = numAmount * (s1 / totalSalary);
      const m2Share = numAmount * (s2 / totalSalary);
      return { [m1.id]: m1Share, [m2.id]: m2Share };
    }
    if (type === 'custom') {
      const dist = {};
      settings.members.forEach(m => {
        const pct = customDist[m.id] || 0;
        dist[m.id] = (numAmount * pct) / 100;
      });
      return dist;
    }
    if (type === 'custom_amount') {
      const dist = {};
      settings.members.forEach(m => {
        dist[m.id] = Number(customAmts[m.id] || 0);
      });
      return dist;
    }
    if (type === 'hybrid') {
      const fixedSum = settings.members.reduce((acc, m) => acc + Number(customAmts[m.id] || 0), 0);
      const remainder = Math.max(0, numAmount - fixedSum);
      
      const s1 = monthlySalaries?.salaries?.[m1.id] || 0;
      const s2 = monthlySalaries?.salaries?.[m2.id] || 0;
      const totalSalary = s1 + s2;
      
      const dist = {};
      settings.members.forEach(m => {
        const sal = monthlySalaries?.salaries?.[m.id] || 0;
        const share = totalSalary > 0 ? (remainder * sal) / totalSalary : remainder / settings.members.length;
        dist[m.id] = share + Number(customAmts[m.id] || 0);
      });
      return dist;
    }
    return {};
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId || !newCharge.name || !newCharge.amount) return;
    
    // Inherit visibility from selected account
    const selectedAccount = settings?.accounts?.find(a => a.id === newCharge.accountId);
    let finalCharge = { ...newCharge };

    // Si compte perso, forcer répartition 100% proprio par défaut si non custom
    if (selectedAccount?.visibility !== 'shared' && newCharge.distributionType !== 'custom' && newCharge.distributionType !== 'custom_amount') {
      const dist = {};
      settings.members.forEach(m => dist[m.id] = (m.id === selectedAccount?.ownerId ? Number(newCharge.amount) : 0));
      finalCharge.distribution = dist;
    } else {
      finalCharge.distribution = calculateDistribution(newCharge.amount, newCharge.distributionType, newCharge.customPercentages, newCharge.customAmounts);
    }
    
    // Déterminer la visibilité finale : si 100% pour moi -> Perso
    const myShare = finalCharge.distribution?.[uid] || 0;
    const isFullyMe = Math.abs(myShare - Number(newCharge.amount)) < 0.01;
    
    const chargeToSave = {
      ...finalCharge,
      amount: Number(newCharge.amount),
      visibility: isFullyMe ? uid : (selectedAccount?.visibility || 'shared')
    };
    
    try {
      const saved = await addCharge(householdId, uid, chargeToSave);
      setCharges([...charges, saved]);
      setShowAddForm(false);
      setNewCharge({ ...newCharge, name: '', amount: '' });
    } catch (error) {
      console.error("Error adding charge", error);
    }
  };

  const handleViewClick = (charge) => {
    setViewingCharge(prev => (prev?.id === charge.id ? null : charge));
  };

  const handleEditFromView = () => {
    const charge = viewingCharge;
    setEditingCharge(charge);
    setViewingCharge(null);
  };

  const handleEditClick = (charge) => {
    setEditingCharge({ ...charge });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !householdId || !editingCharge.id) return;

    const selectedAccount = settings?.accounts?.find(a => a.id === editingCharge.accountId);
    const finalDist = calculateDistribution(editingCharge.amount, editingCharge.distributionType, editingCharge.customPercentages, editingCharge.customAmounts);
    
    const currentMonthStr = `${selectedYear}-${(selectedMonth+1).toString().padStart(2, '0')}`;
    
    // Si la version éditée commence exactement ce mois-ci, on peut la modifier directement
    // Sinon, on crée une nouvelle version pour ne pas casser le passé
    const needsNewVersion = editingCharge.validFrom !== currentMonthStr;

    const myShare = finalDist[uid] || 0;
    const isFullyMe = Math.abs(myShare - Number(editingCharge.amount)) < 0.01;

    if (needsNewVersion) {
      const isNewVersion = await confirm({
        title: 'Mise à jour de la charge',
        message: 'Souhaitez-vous créer une nouvelle version à partir de ce mois ?',
        subMessage: 'Recommandé pour conserver l\'historique de vos anciennes répartitions ou montants.',
        confirmText: 'Nouvelle version',
        cancelText: 'Modifier l\'historique',
        variant: 'info',
        icon: 'settings'
      });

      if (isNewVersion) {
        try {
          // 1. Fermer l'ancienne version
          const prevMonth = new Date(selectedYear, selectedMonth - 1, 1);
          const prevMonthStr = `${prevMonth.getFullYear()}-${(prevMonth.getMonth() + 1).toString().padStart(2, '0')}`;
          await updateCharge(householdId, editingCharge.id, { validTo: prevMonthStr });
          
          // 2. Créer la nouvelle version
          const newVersion = {
            ...editingCharge,
            validFrom: currentMonthStr,
            validTo: null,
            amount: Number(editingCharge.amount),
            distribution: finalDist,
            visibility: isFullyMe ? uid : (selectedAccount?.visibility || 'shared')
          };
          delete newVersion.id;
          await addCharge(householdId, uid, newVersion);
          
          setEditingCharge(null);
          fetchData();
          return;
        } catch (err) {
          console.error(err);
          return;
        }
      }
    }

    // Mise à jour classique
    const updates = {
      ...editingCharge,
      amount: Number(editingCharge.amount),
      distribution: finalDist,
      visibility: isFullyMe ? uid : (selectedAccount?.visibility || 'shared')
    };
    delete updates.id;

    try {
      await updateCharge(householdId, editingCharge.id, updates);
      fetchData();
      setEditingCharge(null);
    } catch (error) {
      console.error("Error updating charge", error);
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Supprimer cette charge ?',
      message: 'Cette action supprimera la charge pour tous les mois futurs.',
      variant: 'danger',
      icon: 'delete',
      confirmText: 'Supprimer',
      cancelText: 'Annuler'
    });

    if (isConfirmed) {
      try {
        await deleteCharge(householdId, id);
        setCharges(charges.filter(c => c.id !== id));
      } catch (error) {
        console.error("Error deleting charge", error);
      }
    }
  };

  const getAccountName = (id) => {
    const acc = settings?.accounts?.find(a => a.id === id);
    return acc ? acc.name : 'Inconnu';
  };

  if (loading) return <div className="page-container" style={{ padding: '2rem' }}><p>Chargement des charges...</p></div>;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Charges Fixes</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestion de vos abonnements et prélèvements réguliers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={18} /> Nouvelle Charge
        </button>
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
      
      {showAddForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', border: '1px solid var(--primary-light)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Ajouter une Charge Fixe</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <div>
              <label className="label">Nom de la charge</label>
              <input type="text" className="input-field" required value={newCharge.name} onChange={e => setNewCharge({...newCharge, name: e.target.value})} placeholder="ex: Loyer, Netflix..." />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input-field" value={newCharge.category} onChange={e => setNewCharge({...newCharge, category: e.target.value})}>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fréquence</label>
              <select className="input-field" value={newCharge.frequency || 'monthly'} onChange={e => setNewCharge({...newCharge, frequency: e.target.value})}>
                <option value="monthly">Mensuelle</option>
                <option value="annual">Annuelle (Lissée sur 12 mois)</option>
              </select>
            </div>
            {newCharge.frequency === 'annual' ? (
              <>
                <div>
                  <label className="label">Montant Annuel Total (€)</label>
                  <input type="number" className="input-field" step="0.01" required value={newCharge.annualAmount} onChange={e => setNewCharge({...newCharge, annualAmount: e.target.value, amount: e.target.value ? (Number(e.target.value) / 12).toFixed(2) : ''})} />
                </div>
                <div>
                  <label className="label">Mois d'échéance</label>
                  <select className="input-field" value={newCharge.annualDueDate} onChange={e => setNewCharge({...newCharge, annualDueDate: e.target.value})}>
                    <option value="">Sélectionner...</option>
                    {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Mensualité Provisionnée (€)</label>
                  <input type="text" className="input-field" disabled value={newCharge.amount ? `${newCharge.amount} € / mois` : ''} style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-secondary)' }} />
                </div>
              </>
            ) : (
              <div>
                <label className="label">Montant Mensuel (€)</label>
                <input type="number" className="input-field" step="0.01" required value={newCharge.amount} onChange={e => setNewCharge({...newCharge, amount: e.target.value})} />
              </div>
            )}
            <div>
              <label className="label">Compte de prélèvement</label>
              <select className="input-field" value={newCharge.accountId} onChange={e => setNewCharge({...newCharge, accountId: e.target.value})}>
                {settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === auth.currentUser?.uid).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.visibility === 'shared' ? 'Commun' : 'Perso'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Méthode de Répartition</label>
              <select className="input-field" value={newCharge.distributionType} onChange={e => setNewCharge({...newCharge, distributionType: e.target.value})}>
                <option value="prorata">Prorata des salaires</option>
                <option value="50_50">50/50</option>
                <option value="custom">Pourcentage (%)</option>
                <option value="custom_amount">Montant fixe (€)</option>
                <option value="hybrid">Hybride (Prorata + Fixe)</option>
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn-small" 
                  style={{ flex: 1, backgroundColor: '#f3e8ff', color: '#a855f7', border: '1px solid #f3e8ff' }}
                  onClick={async () => {
                    const me = settings.members.find(m => m.id === auth.currentUser.uid);
                    if (!me) { 
                      await alert({
                        title: 'Identification requise',
                        message: "Veuillez d'abord vous identifier dans les Paramètres (cliquez sur 'C'est moi') pour que l'app sache qui vous êtes.",
                        variant: 'warning',
                        icon: 'help'
                      });
                      return; 
                    }
                    const distPct = {};
                    const distAmt = {};
                    settings.members.forEach(m => {
                      distPct[m.id] = (m.id === me.id ? 100 : 0);
                      distAmt[m.id] = (m.id === me.id ? Number(newCharge.amount) : 0);
                    });
                    setNewCharge({...newCharge, distributionType: 'custom', customPercentages: distPct, customAmounts: distAmt});
                  }}
                >
                  Tout pour moi
                </button>
                <button 
                  type="button" 
                  className="btn-small" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    const me = settings.members.find(m => m.id === auth.currentUser.uid);
                    const notMe = settings.members.find(m => m.id !== me?.id);
                    if (notMe) {
                      const distPct = {};
                      const distAmt = {};
                      settings.members.forEach(m => {
                        distPct[m.id] = (m.id === notMe.id ? 100 : 0);
                        distAmt[m.id] = (m.id === notMe.id ? Number(newCharge.amount) : 0);
                      });
                      setNewCharge({...newCharge, distributionType: 'custom', customPercentages: distPct, customAmounts: distAmt});
                    }
                  }}
                >
                  Tout pour l'autre
                </button>
              </div>
            </div>
            <div>
              <label className="label">Jour de prélèvement (1-31)</label>
              <input type="number" className="input-field" min="1" max="31" value={newCharge.dueDate} onChange={e => setNewCharge({...newCharge, dueDate: Number(e.target.value)})} />
            </div>
            
            {newCharge.distributionType === 'custom' && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <label className="label" style={{ marginBottom: '1rem' }}>Pourcentages de répartition (%)</label>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  {settings?.members?.map(m => (
                    <div key={m.id} style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>{m.name}</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="number" 
                          className="input-field" 
                          value={newCharge.customPercentages[m.id] ?? ''} 
                          onChange={e => setNewCharge({
                            ...newCharge, 
                            customPercentages: { ...newCharge.customPercentages, [m.id]: Number(e.target.value) }
                          })}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newCharge.distributionType === 'custom_amount' && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label className="label" style={{ margin: 0 }}>Montants fixes (€)</label>
                  {Math.abs(settings.members.reduce((acc, m) => acc + Number(newCharge.customAmounts[m.id] || 0), 0) - Number(newCharge.amount)) > 0.01 && (
                    <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: '500' }}>
                      ⚠ Total : {settings.members.reduce((acc, m) => acc + Number(newCharge.customAmounts[m.id] || 0), 0).toFixed(2)}€ ≠ {Number(newCharge.amount).toFixed(2)}€
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  {settings?.members?.map(m => (
                    <div key={m.id} style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>{m.name}</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="number" 
                          className="input-field" 
                          step="0.01"
                          value={newCharge.customAmounts[m.id] ?? ''} 
                          onChange={e => {
                            const val = e.target.value;
                            const newAmts = { ...newCharge.customAmounts, [m.id]: val };
                            
                            // Si 2 membres, on peut auto-calculer l'autre
                            if (settings.members.length === 2 && newCharge.amount) {
                              const otherMember = settings.members.find(mem => mem.id !== m.id);
                              if (otherMember) {
                                newAmts[otherMember.id] = (Number(newCharge.amount) - Number(val)).toFixed(2);
                              }
                            }
                            
                            setNewCharge({ ...newCharge, customAmounts: newAmts });
                          }}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newCharge.distributionType === 'hybrid' && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <label className="label" style={{ marginBottom: '1rem' }}>Part fixe personnelle (€) <small style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>(Le reste sera réparti au prorata)</small></label>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  {settings?.members?.map(m => (
                    <div key={m.id} style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>{m.name}</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="number" 
                          className="input-field" 
                          step="0.01"
                          value={newCharge.customAmounts[m.id] ?? ''} 
                          onChange={e => setNewCharge({
                            ...newCharge, 
                            customAmounts: { ...newCharge.customAmounts, [m.id]: e.target.value }
                          })}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {newCharge.amount && settings?.members?.length >= 2 && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--primary-light)', padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                  <PieChart size={20} /> Répartition prévue :
                </div>
                {settings.members.map(m => {
                  const dist = calculateDistribution(newCharge.amount, newCharge.distributionType, newCharge.customPercentages, newCharge.customAmounts);
                  return (
                    <div key={m.id}>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.name} :</span> <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{dist[m.id]?.toFixed(2)} €</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer la Charge</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {charges.map(charge => (
          <div key={charge.id} style={{ marginBottom: '1rem' }}>
            <div 
              className="card" 
              style={{ 
                cursor: 'pointer', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '1.25rem 1.5rem', 
                borderBottom: viewingCharge?.id === charge.id ? 'none' : '1px solid var(--border-color)',
                borderBottomLeftRadius: viewingCharge?.id === charge.id ? '0' : 'var(--radius-md)',
                borderBottomRightRadius: viewingCharge?.id === charge.id ? '0' : 'var(--radius-md)',
                transition: 'background-color 0.2s',
                boxShadow: viewingCharge?.id === charge.id ? 'none' : 'var(--shadow-sm)'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor='var(--primary-light)'} 
              onMouseOut={e => e.currentTarget.style.backgroundColor='var(--surface-color)'}
              onClick={() => handleViewClick(charge)}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{charge.name}</h3>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '10px', 
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: getCategoryConfig(charge.category).bg,
                    color: getCategoryConfig(charge.category).color
                  }}>
                    {React.createElement(getCategoryConfig(charge.category).icon, { size: 12 })} {charge.category || 'Autre'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Le {charge.dueDate || 1} • {getAccountName(charge.accountId)}
                    {charge.frequency === 'annual' && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>Annuelle lissée</span>}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{charge.amount.toFixed(2)} €</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {charge.distributionType === 'prorata' ? 'Prorata' : charge.distributionType === '50_50' ? '50/50' : charge.distributionType === 'hybrid' ? 'Hybride' : charge.distributionType === 'custom' ? 'Perso (%)' : 'Montants'}
                  </div>
                </div>
              </div>
            </div>

            {/* Détails Inline (Accordéon) */}
            {viewingCharge?.id === charge.id && (
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
                  <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    {charge.frequency === 'annual' && (
                      <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                        <p style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--primary)' }}>Détails de la charge annuelle :</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Montant total :</span>
                          <span style={{ fontWeight: '600' }}>{Number(charge.annualAmount || 0).toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Mois d'échéance :</span>
                          <span style={{ fontWeight: '600' }}>{charge.annualDueDate || 'Non spécifié'}</span>
                        </div>
                      </div>
                    )}
                     <p style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--primary)' }}>Détails de la répartition :</p>
                    
                    <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Mode : <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                          {charge.distributionType === 'prorata' ? 'Prorata des salaires' : 
                           charge.distributionType === '50_50' ? '50 / 50' : 
                           charge.distributionType === 'hybrid' ? 'Hybride (Fixe + Prorata)' : 
                           charge.distributionType === 'custom_amount' ? 'Montants fixes' : 'Pourcentage perso'}
                        </span>
                      </div>
                      
                      {(charge.distributionType === 'prorata' || charge.distributionType === 'hybrid') && (
                        <div style={{ fontSize: '0.72rem', backgroundColor: 'var(--primary-light)', padding: '0.4rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                          <strong>Revenus pris en compte :</strong><br/>
                          {settings?.members?.map(m => (
                            <span key={m.id} style={{ marginRight: '1rem' }}>
                              {m.name} : {Number(monthlySalaries?.salaries?.[m.id] || 0).toFixed(0)}€
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {settings?.members?.map(m => {
                       const dist = calculateDistribution(charge.amount, charge.distributionType, charge.customPercentages, charge.customAmounts);
                       const isHybrid = charge.distributionType === 'hybrid';
                       const fixedPart = Number(charge.customAmounts?.[m.id] || 0);
                       const prorataPart = dist[m.id] - fixedPart;

                       return (
                        <div key={m.id} style={{ marginBottom: '0.6rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                            <span>{m.name}</span>
                            <span>{dist[m.id]?.toFixed(2)} €</span>
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
                      onClick={(e) => { e.stopPropagation(); handleDelete(charge.id); setViewingCharge(null); }}
                    >
                      <Trash2 size={18} /> Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {charges.length === 0 && !showAddForm && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            Aucune charge fixe enregistrée. Cliquez sur "Nouvelle Charge" pour commencer.
          </div>
        )}
      </div>

      {editingCharge && (
        <div className="modal-overlay" onClick={() => setEditingCharge(null)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Modifier la Charge Fixe</h2>
                <button className="btn btn-outline" style={{ padding: '0.5rem', border: 'none' }} onClick={() => setEditingCharge(null)}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">Nom</label>
                      <input type="text" className="input-field" required value={editingCharge.name} onChange={e => setEditingCharge({...editingCharge, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Catégorie</label>
                      <select className="input-field" value={editingCharge.category || 'Alimentation'} onChange={e => setEditingCharge({...editingCharge, category: e.target.value})}>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">Fréquence</label>
                      <select className="input-field" value={editingCharge.frequency || 'monthly'} onChange={e => setEditingCharge({...editingCharge, frequency: e.target.value})}>
                        <option value="monthly">Mensuelle</option>
                        <option value="annual">Annuelle (Lissée)</option>
                      </select>
                    </div>
                    {editingCharge.frequency === 'annual' ? (
                      <>
                        <div>
                          <label className="label">Montant Annuel (€)</label>
                          <input type="number" className="input-field" step="0.01" required value={editingCharge.annualAmount || ''} onChange={e => setEditingCharge({...editingCharge, annualAmount: e.target.value, amount: e.target.value ? (Number(e.target.value) / 12).toFixed(2) : ''})} />
                        </div>
                        <div>
                          <label className="label">Mois d'échéance</label>
                          <select className="input-field" value={editingCharge.annualDueDate || ''} onChange={e => setEditingCharge({...editingCharge, annualDueDate: e.target.value})}>
                            <option value="">Sélectionner...</option>
                            {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="label">Montant Mensuel (€)</label>
                        <input type="number" className="input-field" step="0.01" required value={editingCharge.amount} onChange={e => setEditingCharge({...editingCharge, amount: e.target.value})} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">Compte</label>
                      <select className="input-field" value={editingCharge.accountId} onChange={e => setEditingCharge({...editingCharge, accountId: e.target.value})}>
                        {settings?.accounts?.filter(a => a.visibility === 'shared' || a.ownerId === auth.currentUser?.uid).map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Répartition</label>
                       <select className="input-field" value={editingCharge.distributionType} onChange={e => {
                        const newType = e.target.value;
                        let updates = { distributionType: newType };
                        if (newType === 'custom_amount' && (!editingCharge.customAmounts || Object.keys(editingCharge.customAmounts).length === 0)) {
                          const currentDist = calculateDistribution(editingCharge.amount, editingCharge.distributionType, editingCharge.customPercentages, editingCharge.customAmounts);
                          updates.customAmounts = currentDist;
                        }
                        setEditingCharge({...editingCharge, ...updates});
                      }}>
                        <option value="prorata">Prorata</option>
                        <option value="50_50">50/50</option>
                        <option value="custom">Pourcentage (%)</option>
                        <option value="custom_amount">Montant (€)</option>
                        <option value="hybrid">Hybride (Prorata + Fixe)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Jour (1-31)</label>
                      <input type="number" className="input-field" min="1" max="31" value={editingCharge.dueDate} onChange={e => setEditingCharge({...editingCharge, dueDate: Number(e.target.value)})} />
                    </div>
                  </div>

                  {editingCharge.distributionType === 'custom' && (
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <label className="label">Pourcentages (%)</label>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        {settings.members.map(m => (
                          <div key={m.id} style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.name}</span>
                            <input 
                              type="number" 
                              className="input-field" 
                              value={editingCharge.customPercentages?.[m.id] || ''} 
                              onChange={e => setEditingCharge({
                                ...editingCharge, 
                                customPercentages: { ...editingCharge.customPercentages, [m.id]: Number(e.target.value) }
                              })} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingCharge.distributionType === 'custom_amount' && (
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="label">Montants fixes (€)</label>
                        {Math.abs(settings.members.reduce((acc, m) => acc + Number(editingCharge.customAmounts?.[m.id] || 0), 0) - Number(editingCharge.amount)) > 0.01 && (
                          <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>
                            ⚠ Total incorrect
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        {settings.members.map(m => (
                          <div key={m.id} style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.name}</span>
                            <input 
                              type="number" 
                              className="input-field" 
                              step="0.01"
                              value={editingCharge.customAmounts?.[m.id] || ''} 
                              onChange={e => {
                                const val = e.target.value;
                                const newAmts = { ...(editingCharge.customAmounts || {}), [m.id]: val };
                                if (settings.members.length === 2 && editingCharge.amount) {
                                  const otherMember = settings.members.find(mem => mem.id !== m.id);
                                  if (otherMember) {
                                    newAmts[otherMember.id] = (Number(editingCharge.amount) - Number(val)).toFixed(2);
                                  }
                                }
                                setEditingCharge({ ...editingCharge, customAmounts: newAmts });
                              }} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingCharge.distributionType === 'hybrid' && (
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
                              value={editingCharge.customAmounts?.[m.id] || ''} 
                              onChange={e => setEditingCharge({
                                ...editingCharge, 
                                customAmounts: { ...(editingCharge.customAmounts || {}), [m.id]: e.target.value }
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
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingCharge(null)}>Annuler</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Mettre à jour</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Charges;
