import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings, updateUserProfile } from '../services/settings';
import { pb } from '../config/pocketbase';
import { Save, Plus, Trash2, Home, Users, Lock, Calendar, Download, Upload, LogOut } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { SettingsSkeleton } from '../components/SkeletonLoader';
import { exportHouseholdData, importHouseholdData } from '../services/backup';

const Settings = ({ householdId, onHouseholdUpdate }) => {
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'auto');
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

  const handleExport = async () => {
    setBackingUp(true);
    try {
      await exportHouseholdData(householdId);
      await alert({ title: 'Exportation réussie', message: 'Votre sauvegarde JSON a été téléchargée.', variant: 'success', icon: 'success' });
    } catch (e) {
      await alert({ title: 'Erreur', message: "Impossible d'exporter vos données.", variant: 'danger', icon: 'error' });
    } finally {
      setBackingUp(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    const ok = await confirm({
      title: 'Importer la sauvegarde ?',
      message: 'ATTENTION : Cette action est irréversible et va ÉCRASER l\'intégralité des dépenses, charges, épargnes et projets actuels de ce foyer par le contenu du fichier de sauvegarde.',
      variant: 'danger',
      confirmText: 'Écraser et Importer',
      cancelText: 'Annuler',
    });

    if (!ok) return;

    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await importHouseholdData(householdId, backup);
      await alert({ title: 'Restauration réussie', message: 'Toutes les données de votre foyer ont été restaurées avec succès.', variant: 'success', icon: 'success' });
      window.location.reload();
    } catch (e) {
      console.error(e);
      await alert({
        title: 'Échec de l\'importation',
        message: e.message || 'Le fichier de sauvegarde est corrompu ou invalide.',
        variant: 'danger',
        icon: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark-theme');
    } else {
      const hour = new Date().getHours();
      if (hour >= 19 || hour < 7) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Se déconnecter ?',
      message: 'Êtes-vous sûr de vouloir fermer votre session active ?',
      variant: 'warning',
      confirmText: 'Déconnexion',
      cancelText: 'Annuler',
    });
    if (ok) {
      pb.authStore.clear();
    }
  };

  const handleMemberChange = (i, field, value) => {
    const m = [...(settings.members || [])];
    m[i][field] = value;
    setSettings({ ...settings, members: m });
  };

  const toggleAccountVisibility = (i) => {
    const a = [...(settings.accounts || [])];
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
              {(settings.members || []).map((member, idx) => {
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
              {(settings.accounts || []).map((acc, idx) => {
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

      {/* Préférences d'affichage */}
      <section className="card" style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={18} /> Préférences d'affichage
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Sélectionnez le mode d'affichage visuel de votre choix pour l'application.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {['light', 'dark', 'auto'].map(t => (
            <button key={t} type="button" onClick={() => handleThemeChange(t)}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: 'none',
                fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                background: theme === t ? 'var(--primary-gradient)' : 'transparent',
                color: theme === t ? 'white' : 'var(--text-secondary)',
                boxShadow: theme === t ? 'var(--shadow-sm)' : 'none',
              }}>
              {t === 'light' ? '☀️ Clair' : t === 'dark' ? '🌙 Sombre' : '🖥️ Automatique'}
            </button>
          ))}
        </div>
      </section>

      {/* Sauvegarde & Restauration */}
      <section className="card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} style={{ color: 'var(--accent)' }} /> Sauvegarde des données
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Exportez toutes vos données de foyer sous forme de fichier JSON ou restaurez une sauvegarde précédente.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" style={{ background: 'var(--accent-light)', color: 'var(--accent)', flex: 1, minWidth: '150px' }}
            onClick={handleExport} disabled={backingUp}>
            <Download size={16} /> {backingUp ? 'Exportation...' : 'Exporter (.json)'}
          </button>
          
          <label className="btn" style={{ border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', flex: 1, minWidth: '150px', margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.45rem' }}>
            <Upload size={16} /> {importing ? 'Importation...' : 'Importer (.json)'}
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} disabled={importing} />
          </label>
        </div>
      </section>

      {/* Déconnexion / Session */}
      <section className="card" style={{ border: '1px solid var(--danger-light)', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogOut size={18} /> Session utilisateur
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Fermez votre session active en cours sur cet appareil.
        </p>
        <button type="button" className="btn" style={{ background: 'var(--danger-light)', color: 'var(--danger)', width: '100%', gap: '0.5rem' }}
          onClick={handleLogout}>
          <LogOut size={16} /> Se déconnecter de l'application
        </button>
      </section>
    </div>
  );
};

export default Settings;

