import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/settings';
import { auth } from '../config/firebase';
import { Save, Plus, Trash2 } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const data = await getSettings(uid);
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      await updateSettings(uid, settings);
      alert('Paramètres sauvegardés avec succès !');
    } catch (error) {
      console.error("Failed to save", error);
      alert('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...settings.members];
    newMembers[index][field] = field === 'salary' ? Number(value) : value;
    setSettings({ ...settings, members: newMembers });
  };

  const handleAccountChange = (index, value) => {
    const newAccounts = [...settings.accounts];
    newAccounts[index].name = value;
    setSettings({ ...settings, accounts: newAccounts });
  };

  const addAccount = () => {
    const newAccount = { id: `a${Date.now()}`, name: 'Nouveau Compte' };
    setSettings({ ...settings, accounts: [...settings.accounts, newAccount] });
  };

  const removeAccount = (index) => {
    const newAccounts = settings.accounts.filter((_, i) => i !== index);
    setSettings({ ...settings, accounts: newAccounts });
  };

  if (loading) return <div className="page-container" style={{ padding: '2rem' }}><p>Chargement des paramètres...</p></div>;

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Paramètres du Foyer</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configuration des profils et salaires pour la répartition logicielle</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </header>
      
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600' }}>Membres du Foyer & Salaires</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {settings.members.map((member, idx) => (
              <div key={member.id} style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label">Nom complet</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={member.name} 
                    onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Revenu mensuel (€)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={member.salary} 
                    onChange={(e) => handleMemberChange(idx, 'salary', e.target.value)}
                  />
                </div>
              </div>
            ))}
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
            {settings.accounts.map((acc, idx) => (
              <div key={acc.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={acc.name} 
                  onChange={(e) => handleAccountChange(idx, e.target.value)}
                />
                <button 
                  style={{ color: 'var(--danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', border: 'none' }}
                  onClick={() => removeAccount(idx)}
                  title="Supprimer ce compte"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            {settings.accounts.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>Aucun compte configuré</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
