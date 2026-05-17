import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings, updateUserProfile } from '../services/settings';
import { pb } from '../config/pocketbase';
import { Save, Plus, Trash2, Home, Users, Lock, Calendar, Download } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { repairAllCategories } from '../utils/categoryRepair';
import { SettingsSkeleton } from '../components/SkeletonLoader';

const Settings = ({ householdId, onHouseholdUpdate }) => {
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [hIdInput, setHidInput] = useState(householdId || '');
  const { alert, confirm } = useConfirm();

  useEffect(() => {
    if (householdId) loadSettings();
    else setLoading(false);
  }, [householdId]);

  const loadSettings = async () => {
    setLoading(true);
    try { setSettings(await getSettings(householdId)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleUpdateHousehold = async () => {
    if (!hIdInput.trim()) return;
    setSaving(true);
    try {
      const uid = pb.authStore.model?.id;
      await updateUserProfile(uid, { householdId: hIdInput.trim() });
      onHouseholdUpdate(hIdInput.trim());
      await alert({ title: 'Foyer mis à jour', message: 'Vous avez rejoint le foyer : ' + hIdInput.trim(), variant: 'success', icon: 'success' });
    } catch (e) {
      await alert({ title: 'Erreur', message: 'Impossible de mettre à jour le foyer.', variant: 'danger', icon: 'error' });
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!householdId) return;
    setSaving(true);
    try {
      await updateSettings(householdId, settings);
      await alert({ title: 'Sauvegarde effectuée', message: 'Les paramètres ont été mis à jour.', variant: 'success', icon: 'save' });
    } catch (e) {
      await alert({ title: 'Erreur', message: 'Erreur lors de la sauvegarde.', variant: 'danger', icon: 'error' });
    } finally { setSaving(false); }
  };

  const handleMemberChange = (i, field, value) => {
    const m = [...settings.members];
    m[i][field] = value;
    setSettings({ ...settings, members: m });
  };

  const toggleAccountVisibility = (i) => {
    const a = [...settings.accounts];
    const isShared = (a[i].visibility || 'shared') === 'shared';
    a[i].visibility = isShared ? 'private' : 'shared';
    if (!isShared) delete a[i].ownerId;
    else a[i].ownerId = pb.authStore.model?.id;
    setSettings({ ...settings, accounts: a });
  };

  const uid = pb.authStore.model?.id;

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="page-container animate-fade-in">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '400', letterSpacing: '-0.3px', marginBottom: '0.15rem' }}>Paramètres</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Foyer : {householdId || 'Non configuré'}</p>
        </div>
        {settings && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: '0.4rem', padding: '0.6rem 1rem', fontSize: '0.875rem' }}>
            <Save size={15} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        )}
      </header>

      {/* Identifiant foyer */}
      <section className="card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Home size={18} /> Identifiant du foyer partagé
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Saisissez le même code que votre conjoint(e) pour partager vos finances.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input type="text" className="input-field" placeholder="ex: FAMILLE_GOMEZ" value={hIdInput} onChange={e => setHidInput(e.target.value)} />
          <button className="btn" style={{ border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={handleUpdateHousehold} disabled={saving}>
            Rejoindre
          </button>
        </div>
      </section>

      {/* Jour de début de mois */}
      {settings && (
        <section className="card" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} /> Début du mois comptable
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Si vous êtes payé le 15, le mois va du 15 au 14 du mois suivant. Les dépenses et le dashboard s'adaptent automatiquement.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: '0 0 auto' }}>
              <label className="label">Jour de début (1–28)</label>
              <input
                type="number" className="input-field" min="1" max="28" style={{ width: '120px' }}
                value={settings.accountStartDay || 1}
                onChange={e => setSettings({ ...settings, accountStartDay: Math.min(28, Math.max(1, Number(e.target.value))) })}
              />
            </div>
            <div style={{ background: 'var(--primary-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '500', flex: 1 }}>
              {settings.accountStartDay > 1
                ? `Le mois courant va du ${settings.accountStartDay} au ${settings.accountStartDay - 1} du mois suivant.`
                : 'Mois calendaire standard (du 1er au dernier jour).'}
            </div>
          </div>
        </section>
      )}

      {settings && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
          {/* Membres */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem' }}>Membres du foyer</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {settings.members.map((member, idx) => {
                const isMe = member.id === uid;
                return (
                  <div key={member.id} style={{ padding: '0.875rem', background: isMe ? 'var(--primary-light)' : 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: isMe ? '1px solid var(--primary)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="label" style={{ margin: 0 }}>Membre {idx + 1}</label>
                      {isMe
                        ? <span style={{ fontSize: '0.68rem', background: 'var(--primary)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: '700' }}>MOI</span>
                        : (
                          <button className="btn-small" onClick={async () => {
                            const oldId = settings.members[idx].id;
                            const newAccounts = settings.accounts.map(a => ({ ...a, ownerId: a.ownerId === oldId ? uid : a.ownerId }));
                            const newMembers = settings.members.map((m, i) => {
                              if (m.id === uid) return { ...m, id: `m${i + 1}` };
                              if (i === idx) return { ...m, id: uid };
                              return m;
                            });
                            setSettings({ ...settings, members: newMembers, accounts: newAccounts });
                            try {
                              await import('../services/migration').then(mod => mod.migrateMemberId(householdId, oldId, uid));
                              await alert({ title: 'Profil lié', message: 'Votre compte est désormais lié à ce membre.', variant: 'success', icon: 'success' });
                            } catch (err) { console.error(err); }
                          }}>C'est moi</button>
                        )}
                    </div>
                    <input type="text" className="input-field" value={member.name} onChange={e => handleMemberChange(idx, 'name', e.target.value)} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comptes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Comptes bancaires</h2>
              <button className="btn-small" onClick={() => setSettings({ ...settings, accounts: [...settings.accounts, { id: `a${Date.now()}`, name: 'Nouveau compte', visibility: 'shared' }] })}>
                <Plus size={13} style={{ display: 'inline', marginRight: '3px' }} /> Ajouter
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {settings.accounts.map((acc, idx) => {
                const isMine = acc.ownerId === uid;
                const isShared = acc.visibility === 'shared';
                if (!isShared && !isMine) return null;
                return (
                  <div key={acc.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <input type="text" className="input-field" value={acc.name}
                      onChange={e => {
                        const a = [...settings.accounts]; a[idx].name = e.target.value;
                        setSettings({ ...settings, accounts: a });
                      }} />
                    <button type="button" onClick={() => toggleAccountVisibility(idx)}
                      style={{ padding: '0.45rem', border: 'none', background: 'transparent', color: isShared ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', borderRadius: '6px' }}
                      title={isShared ? 'Partagé' : 'Privé'}>
                      {isShared ? <Users size={17} /> : <Lock size={17} />}
                    </button>
                    <button onClick={() => setSettings({ ...settings, accounts: settings.accounts.filter((_, i) => i !== idx) })}
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Maintenance */}
      <div className="card" style={{ border: '1px solid var(--warning-light)', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--warning)' }}>Outils de maintenance</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Si vos graphiques ne s'affichent pas correctement, lancez une réparation automatique des catégories.
        </p>
        <button className="btn" style={{ border: '1px solid var(--warning)', color: 'var(--warning)' }}
          onClick={async () => {
            try {
              const count = await repairAllCategories(householdId);
              await alert({ title: 'Réparation terminée', message: `${count} éléments catégorisés.`, variant: 'success', icon: 'settings' });
              window.location.reload();
            } catch (err) {
              await alert({ title: 'Erreur', message: 'Une erreur est survenue.', variant: 'danger', icon: 'error' });
            }
          }}>
          🪄 Réparer les catégories
        </button>
      </div>

      {/* Export Firebase (migration one-shot) */}
      <div className="card" style={{ border: '1px solid var(--border-solid)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} /> Export données Firebase
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Téléchargez toutes vos données Firebase au format JSON pour les importer dans PocketBase.
        </p>
        <ExportFirebaseButton householdId={householdId} />
      </div>
    </div>
  );
};

// ─── Composant d'export Firebase ────────────────────────────────────────────
import {
  collection, getDocs, doc, getDoc
} from 'firebase/firestore';
import { db as firebaseDb } from '../config/firebase';

const ExportFirebaseButton = ({ householdId }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!householdId) return;
    setExporting(true);
    try {
      const backup = { householdId, exportedAt: new Date().toISOString() };

      // Settings
      const settingsSnap = await getDoc(doc(firebaseDb, 'households', householdId, 'config', 'settings'));
      backup.settings = settingsSnap.exists() ? settingsSnap.data() : null;

      // Collections
      const cols = ['expenses', 'charges', 'settlements', 'savings', 'projects', 'salaries'];
      for (const colName of cols) {
        const snap = await getDocs(collection(firebaseDb, 'households', householdId, colName));
        backup[colName] = snap.docs.map(d => ({ _firebaseId: d.id, ...d.data() }));
      }

      // Téléchargement
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `backup-firebase-${householdId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error', err);
      alert('Erreur lors de l\'export : ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      className="btn"
      style={{ border: '1px solid var(--border-solid)', gap: '0.4rem' }}
      onClick={handleExport}
      disabled={exporting || !householdId}
    >
      <Download size={15} />
      {exporting ? 'Export en cours…' : 'Télécharger backup.json'}
    </button>
  );
};

export default Settings;
