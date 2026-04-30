import React, { useState, useEffect } from 'react';
import { getSavings, addSaving, updateSaving, deleteSaving } from '../services/savings';
import { auth } from '../config/firebase';
import { Plus, Edit2, Trash2, PiggyBank, Landmark, Wallet, TrendingUp, MoreHorizontal } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { ListPageSkeleton } from '../components/SkeletonLoader';
import InlineForm, { FormField, ToggleGroup } from '../components/InlineForm';

const DESTINATION_ICONS = {
  'Livret A': PiggyBank,
  'Livret B': Landmark,
  'PEL': Landmark,
  'CEL': Landmark,
  'Assurance vie': TrendingUp,
  'Compte vacances': Wallet,
  'Autre': MoreHorizontal,
};
const DESTINATIONS = Object.keys(DESTINATION_ICONS);

const VISIBILITY_OPTIONS = [
  { value: 'shared', label: '🏠 Foyer', desc: 'Les deux membres' },
  { value: 'perso',  label: '👤 Perso',  desc: 'Personnel uniquement' },
];

const defaultForm = {
  name: '', destination: 'Livret A', customDestination: '',
  amount: '', visibility: 'shared', note: '',
};

const Savings = ({ householdId }) => {
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const { confirm } = useConfirm();

  useEffect(() => { fetchData(); }, [householdId]);

  const fetchData = async () => {
    try { setSavings(await getSavings(householdId)); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowAdd(true);
    setTimeout(() => document.getElementById('saving-name-input')?.focus(), 380);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      destination: DESTINATIONS.includes(s.destination) ? s.destination : 'Autre',
      customDestination: DESTINATIONS.includes(s.destination) ? '' : s.destination,
      amount: String(s.amount),
      visibility: s.visibility || 'shared',
      note: s.note || '',
    });
    setEditingId(s.id);
    setShowAdd(true);
  };

  const closeForm = () => { setShowAdd(false); setEditingId(null); };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    const destination = form.destination === 'Autre' && form.customDestination
      ? form.customDestination : form.destination;
    const payload = {
      name: form.name.trim(), destination,
      amount: Number(form.amount),
      visibility: form.visibility,
      note: form.note.trim(),
    };
    if (editingId) {
      await updateSaving(householdId, editingId, payload);
      setSavings(prev => prev.map(s => s.id === editingId ? { ...s, ...payload } : s));
    } else {
      const created = await addSaving(householdId, uid, payload);
      setSavings(prev => [...prev, created]);
    }
    closeForm();
  };

  const handleDelete = async (s) => {
    const ok = await confirm({
      title: 'Supprimer cette épargne ?',
      message: `"${s.name}" sera supprimé définitivement.`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!ok) return;
    await deleteSaving(householdId, s.id);
    setSavings(prev => prev.filter(x => x.id !== s.id));
  };

  if (loading) return <ListPageSkeleton rows={3} />;

  const sharedSavings = savings.filter(s => s.visibility === 'shared');
  const persoSavings  = savings.filter(s => s.visibility === 'perso');
  const totalMonthly  = savings.reduce((a, s) => a + Number(s.amount), 0);
  const totalShared   = sharedSavings.reduce((a, s) => a + Number(s.amount), 0);

  const DestIcon = ({ dest }) => {
    const Icon = DESTINATION_ICONS[dest] || MoreHorizontal;
    return <Icon size={17} />;
  };

  const SavingRow = ({ s }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.875rem',
      padding: '0.875rem 1.1rem',
      background: editingId === s.id ? 'var(--primary-light)' : 'transparent',
      borderRadius: 'var(--radius-md)',
      transition: 'background 0.2s ease',
    }}>
      <div className="icon-badge icon-badge-success" style={{ flexShrink: 0 }}>
        <DestIcon dest={s.destination} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
          <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{s.name}</span>
          <span className="dist-badge">{s.visibility === 'shared' ? 'Foyer' : 'Perso'}</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.destination}</span>
        {s.note && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '1px' }}>{s.note}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '1.2rem',
          color: 'var(--primary)', lineHeight: 1,
        }}>
          {Number(s.amount).toFixed(0)} €
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginLeft: '2px' }}>/mois</span>
        </span>
        <button onClick={() => openEdit(s)} style={{ color: 'var(--text-muted)', padding: '0.3rem', borderRadius: '6px', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <Edit2 size={14} />
        </button>
        <button onClick={() => handleDelete(s)} style={{ color: 'var(--text-muted)', padding: '0.3rem', borderRadius: '6px', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in">

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '400', letterSpacing: '-0.3px', marginBottom: '0.15rem' }}>Épargne</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Virements récurrents mensuels</p>
        </div>
        <button onClick={showAdd ? closeForm : openAdd} className="btn btn-primary"
          style={{ gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}>
          <Plus size={15} style={{ transition: 'transform 0.25s ease', transform: showAdd && !editingId ? 'rotate(45deg)' : 'none' }} />
          {showAdd && !editingId ? 'Annuler' : 'Ajouter'}
        </button>
      </header>

      {/* Formulaire inline */}
      <InlineForm
        open={showAdd}
        onClose={closeForm}
        title={editingId ? 'Modifier l\'épargne' : 'Nouvelle épargne récurrente'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Enregistrer' : 'Ajouter'}
      >
        <FormField label="Nom">
          <input id="saving-name-input" className="input-field" placeholder="Ex : Épargne de précaution"
            required value={form.name} onChange={f('name')} />
        </FormField>

        <FormField label="Destination">
          <select className="input-field" value={form.destination} onChange={f('destination')}>
            {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormField>

        {form.destination === 'Autre' && (
          <FormField label="Préciser">
            <input className="input-field" placeholder="Ex : Compte épargne BNP"
              value={form.customDestination} onChange={f('customDestination')} />
          </FormField>
        )}

        <FormField label="Montant mensuel (€)">
          <input className="input-field" type="number" min="1" step="1" placeholder="150"
            required value={form.amount} onChange={f('amount')} />
        </FormField>

        <FormField label="Qui épargne ?">
          <ToggleGroup options={VISIBILITY_OPTIONS} value={form.visibility}
            onChange={v => setForm(p => ({ ...p, visibility: v }))} />
        </FormField>

        <FormField label="Note (optionnel)">
          <input className="input-field" placeholder="Remarque libre…"
            value={form.note} onChange={f('note')} />
        </FormField>
      </InlineForm>

      {/* Récap */}
      {savings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.1rem' }}>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <span className="label">Total mensuel</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--primary)', marginTop: '0.2rem' }}>{totalMonthly.toFixed(0)} €</p>
          </div>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <span className="label">Part foyer</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{totalShared.toFixed(0)} €</p>
          </div>
        </div>
      )}

      {/* Listes */}
      {savings.length === 0 && !showAdd ? (
        <div className="empty-state">
          <PiggyBank size={30} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', display: 'block' }} />
          <p style={{ fontWeight: '700', marginBottom: '0.35rem' }}>Aucune épargne configurée</p>
          <p style={{ fontSize: '0.85rem' }}>Ajoutez vos virements récurrents mensuels.</p>
        </div>
      ) : (
        <>
          {sharedSavings.length > 0 && (
            <div className="card" style={{ padding: '0.25rem 0', marginBottom: '0.75rem' }}>
              <p className="label" style={{ padding: '0.75rem 1.1rem 0.4rem' }}>Foyer</p>
              <div>
                {sharedSavings.map((s, i) => (
                  <div key={s.id}>
                    <SavingRow s={s} />
                    {i < sharedSavings.length - 1 && (
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 1.1rem' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {persoSavings.length > 0 && (
            <div className="card" style={{ padding: '0.25rem 0', marginBottom: '0.75rem' }}>
              <p className="label" style={{ padding: '0.75rem 1.1rem 0.4rem' }}>Perso</p>
              <div>
                {persoSavings.map((s, i) => (
                  <div key={s.id}>
                    <SavingRow s={s} />
                    {i < persoSavings.length - 1 && (
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 1.1rem' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {savings.length > 0 && (
        <div className="alert-banner alert-banner-info" style={{ marginTop: '0.25rem' }}>
          <PiggyBank size={14} />
          <span style={{ fontSize: '0.8rem' }}>
            L'épargne foyer est déduite du reste à vivre dans le dashboard.
          </span>
        </div>
      )}

    </div>
  );
};

export default Savings;
