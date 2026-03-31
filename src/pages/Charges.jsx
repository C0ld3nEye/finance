import React, { useState, useEffect } from 'react';
import { getCharges, addCharge, deleteCharge } from '../services/charges';
import { getSettings } from '../services/settings';
import { auth } from '../config/firebase';
import { Plus, Trash2, PieChart } from 'lucide-react';

const Charges = () => {
  const [charges, setCharges] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCharge, setNewCharge] = useState({
    name: '',
    amount: '',
    accountId: '',
    distributionType: 'prorata',
    customDistribution: {}
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const [chargesData, settingsData] = await Promise.all([
        getCharges(uid),
        getSettings(uid)
      ]);
      setCharges(chargesData);
      setSettings(settingsData);
      if (settingsData.accounts.length > 0) {
        setNewCharge(prev => ({ ...prev, accountId: settingsData.accounts[0].id }));
      }
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistribution = (amount, type, customDist = {}) => {
    if (!settings || !amount || settings.members.length < 2) return {};
    const numAmount = Number(amount);
    const m1 = settings.members[0];
    const m2 = settings.members[1];
    
    if (type === '50_50') {
      return { [m1.id]: numAmount / 2, [m2.id]: numAmount / 2 };
    }
    if (type === 'prorata') {
      const totalSalary = m1.salary + m2.salary;
      if (totalSalary === 0) return { [m1.id]: numAmount / 2, [m2.id]: numAmount / 2 };
      const m1Share = numAmount * (m1.salary / totalSalary);
      const m2Share = numAmount * (m2.salary / totalSalary);
      return { [m1.id]: m1Share, [m2.id]: m2Share };
    }
    return customDist;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !newCharge.name || !newCharge.amount) return;
    
    const finalDist = calculateDistribution(newCharge.amount, newCharge.distributionType, newCharge.customDistribution);
    
    const chargeToSave = {
      ...newCharge,
      amount: Number(newCharge.amount),
      distribution: finalDist
    };
    
    try {
      const saved = await addCharge(uid, chargeToSave);
      setCharges([...charges, saved]);
      setShowAddForm(false);
      setNewCharge({ ...newCharge, name: '', amount: '' });
    } catch (error) {
      console.error("Error adding charge", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette charge fixe ?')) {
      await deleteCharge(id);
      setCharges(charges.filter(c => c.id !== id));
    }
  };

  const getAccountName = (id) => {
    if (!settings) return '';
    const acc = settings.accounts.find(a => a.id === id);
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
      
      {showAddForm && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', border: '1px solid var(--primary-light)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Ajouter une Charge Fixe</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <div>
              <label className="label">Nom de la charge</label>
              <input type="text" className="input-field" required value={newCharge.name} onChange={e => setNewCharge({...newCharge, name: e.target.value})} placeholder="ex: Loyer, Netflix..." />
            </div>
            <div>
              <label className="label">Montant Mensuel (€)</label>
              <input type="number" className="input-field" step="0.01" required value={newCharge.amount} onChange={e => setNewCharge({...newCharge, amount: e.target.value})} />
            </div>
            <div>
              <label className="label">Compte de prélèvement</label>
              <select className="input-field" value={newCharge.accountId} onChange={e => setNewCharge({...newCharge, accountId: e.target.value})}>
                {settings.accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Méthode de Répartition</label>
              <select className="input-field" value={newCharge.distributionType} onChange={e => setNewCharge({...newCharge, distributionType: e.target.value})}>
                <option value="prorata">Prorata des salaires</option>
                <option value="50_50">50/50</option>
                <option value="custom">Personnalisée</option>
              </select>
            </div>
            
            {newCharge.amount && newCharge.distributionType !== 'custom' && settings.members.length >= 2 && (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--primary-light)', padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                  <PieChart size={20} /> Répartition prévue :
                </div>
                {settings.members.map(m => {
                  const dist = calculateDistribution(newCharge.amount, newCharge.distributionType);
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
          <div key={charge.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{charge.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Prélevé sur le compte <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{getAccountName(charge.accountId)}</span></p>
            </div>
            <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'right' }}>
                {settings && settings.members.slice(0, 2).map(m => (
                   <div key={m.id}>
                     <div style={{ fontSize: '0.75rem' }}>{m.name}</div>
                     <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{charge.distribution?.[m.id]?.toFixed(2) || '0.00'} €</div>
                   </div>
                ))}
              </div>
              <div style={{ textAlign: 'right', minWidth: '80px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{charge.amount.toFixed(2)} €</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{charge.distributionType.replace('_', '/')}</div>
              </div>
              <button onClick={() => handleDelete(charge.id)} style={{ color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'transparent', cursor: 'pointer', border: 'none', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color='var(--danger)'} onMouseOut={e => e.currentTarget.style.color='var(--text-secondary)'}>
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {charges.length === 0 && !showAddForm && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            Aucune charge fixe enregistrée. Cliquez sur "Nouvelle Charge" pour commencer.
          </div>
        )}
      </div>
    </div>
  );
};

export default Charges;
