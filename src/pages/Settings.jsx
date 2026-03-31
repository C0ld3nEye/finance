import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings, updateUserProfile } from '../services/settings';
import { auth } from '../config/firebase';
import { Save, Plus, Trash2, Home, Users, Lock } from 'lucide-react';

const Settings = ({ householdId, onHouseholdUpdate }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hIdInput, setHidInput] = useState(householdId || '');

  useEffect(() => {
    if (householdId) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [householdId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings(householdId);
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHousehold = async () => {
    if (!hIdInput.trim()) return;
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      await updateUserProfile(uid, { householdId: hIdInput.trim() });
      onHouseholdUpdate(hIdInput.trim());
      alert('Foyer mis à jour !');
    } catch (error) {
      console.error(error);
      alert('Erreur lors de la mise à jour du foyer.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!householdId) return;
    setSaving(true);
    try {
      await updateSettings(householdId, settings);
      alert('Paramètres du foyer sauvegardés !');
    } catch (error) {
      console.error(error);
      alert('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...settings.members];
    newMembers[index][field] = value;
    setSettings({ ...settings, members: newMembers });
  };

  const toggleAccountVisibility = (index) => {
    const newAccounts = [...settings.accounts];
    const current = newAccounts[index].visibility || 'shared';
    newAccounts[index].visibility = current === 'shared' ? 'private' : 'shared';
    
    if (newAccounts[index].visibility === 'private') {
      newAccounts[index].ownerId = auth.currentUser?.uid;
    } else {
      delete newAccounts[index].ownerId;
    }
    setSettings({ ...settings, accounts: newAccounts });
  };

  const handleAccountChange = (index, value) => {
    const newAccounts = [...settings.accounts];
    newAccounts[index].name = value;
    setSettings({ ...settings, accounts: newAccounts });
  };

  const addAccount = () => {
    const newAccount = { 
      id: `a${Date.now()}`, 
      name: 'Nouveau Compte', 
      visibility: 'shared' 
    };
    setSettings({ ...settings, accounts: [...settings.accounts, newAccount] });
  };

  const removeAccount = (index) => {
    const newAccounts = settings.accounts.filter((_, i) => i !== index);
    setSettings({ ...settings, accounts: newAccounts });
  };

  if (loading) return <div className="page-container" style={{ padding: '2rem' }}><p>Chargement...</p></div>;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>Paramètres</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Foyer : {householdId || 'Non configuré'}</p>
        </div>
        {settings && (
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving}>
            <Save size={18} /> {saving ? 'Sauvegarde...' : 'Sauvegarder les réglages'}
          </button>
        )}
      </header>

      <section className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Home size={20} /> Identifiant du Foyer Partagé
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Saisissez le même code que votre conjoint(e) pour partager vos finances.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="ex: FAMILLE_GOMEZ" 
            value={hIdInput}
            onChange={e => setHidInput(e.target.value)}
          />
          <button className="btn btn-outline" onClick={handleUpdateHousehold} disabled={saving}>
            Rejoindre / Mettre à jour
          </button>
        </div>
      </section>
      
      {settings && (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Membres du Foyer & Salaires</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {settings.members.map((member, idx) => {
                const isMe = member.id === auth.currentUser?.uid;
                return (
                  <div key={member.id} style={{ padding: '1rem', backgroundColor: isMe ? '#eff6ff' : 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: isMe ? '1px solid #3b82f6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="label" style={{ margin: 0 }}>Membre {idx + 1}</label>
                      {isMe ? (
                         <span style={{ fontSize: '0.7rem', backgroundColor: '#3b82f6', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '12px' }}>MOI</span>
                      ) : (
                        <button 
                          className="btn-small" 
                          onClick={async () => {
                            const oldId = settings.members[idx].id;
                            const newId = auth.currentUser.uid;
                            
                            // Migrer les comptes si liés à l'ancien ID
                            const newAccounts = settings.accounts.map(acc => ({
                              ...acc,
                              ownerId: acc.ownerId === oldId ? newId : acc.ownerId
                            }));
                            
                            const newMembers = settings.members.map((m, i) => {
                              if (m.id === newId) return { ...m, id: `m${i+1}` };
                              if (i === idx) return { ...m, id: newId };
                              return m;
                            });

                            setSettings({ ...settings, members: newMembers, accounts: newAccounts });
                            
                            // Migration Firestore
                            try {
                              await import('../services/migration').then(m => m.migrateMemberId(householdId, oldId, newId));
                              alert("Lien établi et données migrées !");
                            } catch (err) {
                              console.error("Migration error", err);
                            }
                          }}
                        >
                          C'est moi
                        </button>
                      )}
                    </div>
                    <input type="text" className="input-field" value={member.name} onChange={e => handleMemberChange(idx, 'name', e.target.value)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Comptes Bancaires</h2>
              <button className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={addAccount}>
                <Plus size={16} /> Ajouter
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {settings.accounts.map((acc, idx) => {
                // Determine if we should show it (shared or mine)
                // If it's private but not mine, we don't even see it in the list
                const isMine = acc.ownerId === auth.currentUser?.uid;
                const isShared = acc.visibility === 'shared';
                
                if (!isShared && !isMine) return null;
                
                return (
                  <div key={acc.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
                    <input type="text" className="input-field" value={acc.name} onChange={e => handleAccountChange(idx, e.target.value)} />
                    <button 
                      type="button" 
                      onClick={() => toggleAccountVisibility(idx)}
                      className="btn btn-outline"
                      style={{ padding: '0.5rem', border: 'none', color: isShared ? 'var(--primary)' : 'var(--text-secondary)' }}
                      title={isShared ? 'Partagé avec le foyer' : 'Privé'}
                    >
                      {isShared ? <Users size={18} /> : <Lock size={18} />}
                    </button>
                    <button onClick={() => removeAccount(idx)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ marginTop: '2rem', border: '1px solid var(--warning-light)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--warning)' }}>Outils de Maintenance</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Si vos graphiques ne s'affichent pas correctement (catégories manquantes), vous pouvez lancer une réparation automatique de vos anciennes données.
        </p>
        <button 
          className="btn btn-outline" 
          style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
          onClick={async () => {
             const MAPPING = {
               'Alimentation': ['course', 'carrefour', 'leclerc', 'lidl', 'monoprix', 'boulangerie', 'picard', 'resto', 'intermarche', 'super u', 'aldi', 'franprix', 'casino', 'auchan', 'mcdo', 'burger king', 'pizza', 'deliveroo', 'uber eats'],
               'Logement': ['loyer', 'credit', 'pret immo', 'edf', 'engie', 'eau', 'habitation', 'copro'],
               'Transport': ['essence', 'total', 'esso', 'peage', 'parking', 'sncf', 'train', 'bus', 'metro', 'ratp', 'voiture', 'garage'],
               'Abonnements': ['netflix', 'spotify', 'amazon', 'prime', 'internet', 'box', 'sfr', 'orange', 'bouygues', 'free', 'telephone', 'canal', 'deezer', 'icloud', 'disney'],
               'Santé': ['pharmacie', 'medecin', 'mutuelle', 'dentiste', 'opticien', 'doctolib'],
               'Loisirs': ['cine', 'cinema', 'jeu', 'steam', 'playstation', 'nintendo', 'sortie', 'parc'],
               'Cadeaux': ['cadeau', 'anniversaire', 'noel'],
               'Animaux': ['veto', 'veterinaire', 'croquettes', 'chien', 'chat', 'maxizoo'],
               'Sport': ['gym', 'fitness', 'club', 'sport', 'tennis', 'foot', 'piscine']
             };
             
             const updateCat = async (coll) => {
               const { collection, getDocs, updateDoc } = await import('firebase/firestore');
               const { db } = await import('../config/firebase');
               const snap = await getDocs(collection(db, 'households', householdId, coll));
               let count = 0;
               for (const d of snap.docs) {
                 const data = d.data();
                 if (!data.category || data.category === 'Autre') {
                   const n = (data.description || data.name || '').toLowerCase();
                   for (const [cat, keywords] of Object.entries(MAPPING)) {
                     if (keywords.some(k => n.includes(k))) {
                        await updateDoc(d.ref, { category: cat });
                        count++;
                        break;
                     }
                   }
                 }
               }
               return count;
             };

             try {
               const expCount = await updateCat('expenses');
               const charCount = await updateCat('charges');
               alert(`Réparation terminée ! ${expCount + charCount} éléments ont été catégorisés.`);
               window.location.reload();
             } catch (err) {
               console.error(err);
               alert("Erreur lors de la réparation.");
             }
          }}
        >
          🪄 Réparer mes catégories (Nettoyage automatique)
        </button>
      </div>
    </div>
  );
};

export default Settings;
