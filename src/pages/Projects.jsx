import React, { useState, useEffect } from 'react';
import {
  getProjects, addProject, updateProject, deleteProject,
  addContribution, removeContribution
} from '../services/projects';
import { auth } from '../config/firebase';
import {
  Plus, X, Trash2, Edit2, ChevronDown, ChevronUp,
  Car, Home, Plane, Wrench, GraduationCap, Baby,
  Laptop, Gift, MoreHorizontal, Check
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { ListPageSkeleton } from '../components/SkeletonLoader';
import InlineForm, { FormField, ToggleGroup } from '../components/InlineForm';

const PROJECT_ICONS = {
  Vacances: Plane, Voiture: Car, Logement: Home, Travaux: Wrench,
  Études: GraduationCap, Bébé: Baby, Informatique: Laptop, Cadeau: Gift, Autre: MoreHorizontal,
};
const ICON_KEYS = Object.keys(PROJECT_ICONS);

const defaultForm = { name: '', iconKey: 'Vacances', targetAmount: '', targetDate: '', description: '' };
const defaultContrib = { amount: '', note: '' };

const Projects = ({ householdId }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [expandedId, setExpandedId] = useState(null);
  const [contribTarget, setContribTarget] = useState(null);
  const [contrib, setContrib] = useState(defaultContrib);
  const { confirm } = useConfirm();

  useEffect(() => { fetchData(); }, [householdId]);

  const fetchData = async () => {
    try {
      const data = await getProjects(householdId);
      setProjects(data.sort((a, b) => (a.status === 'archived' ? 1 : 0) - (b.status === 'archived' ? 1 : 0)));
    } finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowAdd(true);
    setTimeout(() => document.getElementById('project-name-input')?.focus(), 380);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name, iconKey: p.iconKey || 'Autre',
      targetAmount: String(p.targetAmount),
      targetDate: p.targetDate || '',
      description: p.description || '',
    });
    setEditingId(p.id);
    setShowAdd(true);
  };

  const closeForm = () => { setShowAdd(false); setEditingId(null); };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    const payload = {
      name: form.name.trim(), iconKey: form.iconKey,
      targetAmount: Number(form.targetAmount),
      targetDate: form.targetDate,
      description: form.description.trim(),
    };
    if (editingId) {
      await updateProject(householdId, editingId, payload);
      setProjects(prev => prev.map(p => p.id === editingId ? { ...p, ...payload } : p));
    } else {
      const created = await addProject(householdId, uid, payload);
      setProjects(prev => [...prev, created]);
    }
    closeForm();
  };

  const handleDelete = async (p) => {
    const ok = await confirm({
      title: 'Supprimer ce projet ?',
      message: `"${p.name}" et toutes ses contributions seront supprimés.`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!ok) return;
    await deleteProject(householdId, p.id);
    setProjects(prev => prev.filter(x => x.id !== p.id));
  };

  const handleArchive = async (p) => {
    const newStatus = p.status === 'archived' ? 'active' : 'archived';
    await updateProject(householdId, p.id, { status: newStatus });
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
  };

  const handleAddContrib = async (p) => {
    if (!contrib.amount || Number(contrib.amount) <= 0) return;
    const result = await addContribution(householdId, p, contrib.amount, contrib.note);
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, ...result } : x));
    setContribTarget(null);
    setContrib(defaultContrib);
  };

  const handleRemoveContrib = async (p, idx) => {
    const ok = await confirm({ title: 'Supprimer ce versement ?', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    const result = await removeContribution(householdId, p, idx);
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, ...result } : x));
  };

  if (loading) return <ListPageSkeleton rows={3} />;

  const active   = projects.filter(p => p.status !== 'archived');
  const archived = projects.filter(p => p.status === 'archived');

  const totalTarget  = active.reduce((a, p) => a + Number(p.targetAmount  || 0), 0);
  const totalCurrent = active.reduce((a, p) => a + Number(p.currentAmount || 0), 0);

  const ProjectCard = ({ p }) => {
    const Icon = PROJECT_ICONS[p.iconKey] || MoreHorizontal;
    const pct = p.targetAmount > 0 ? Math.min((p.currentAmount / p.targetAmount) * 100, 100) : 0;
    const remaining = Math.max(0, p.targetAmount - p.currentAmount);
    const isExpanded = expandedId === p.id;
    const isReached  = p.status === 'reached';
    const isArchived = p.status === 'archived';
    const showContrib = contribTarget === p.id;

    let monthsLeft = null, monthlyNeeded = null;
    if (p.targetDate) {
      const target = new Date(p.targetDate);
      const now = new Date();
      monthsLeft = Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
      if (monthsLeft > 0 && remaining > 0) monthlyNeeded = remaining / monthsLeft;
    }

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: isArchived ? 0.65 : 1, transition: 'opacity 0.2s' }}>

        {/* Corps principal */}
        <div style={{ padding: '1rem 1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>

            {/* Icône */}
            <div className="icon-badge" style={{
              background: isReached ? 'var(--success-light)' : 'var(--primary-light)',
              color: isReached ? 'var(--success)' : 'var(--primary)',
              flexShrink: 0, marginTop: '1px',
            }}>
              {isReached ? <Check size={17} /> : <Icon size={17} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Titre + actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', display: 'block' }}>{p.name}</span>
                  {p.description && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.description}</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.1rem', flexShrink: 0 }}>
                  <button onClick={() => openEdit(p)} style={{ color: 'var(--text-muted)', padding: '0.3rem', borderRadius: '6px', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(p)} style={{ color: 'var(--text-muted)', padding: '0.3rem', borderRadius: '6px', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Barre progression */}
              <div style={{ margin: '0.6rem 0 0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {Number(p.currentAmount || 0).toFixed(0)} €
                    <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}> / {Number(p.targetAmount).toFixed(0)} €</span>
                  </span>
                  <span style={{ fontWeight: '700', color: isReached ? 'var(--success)' : 'var(--primary)' }}>{pct.toFixed(0)} %</span>
                </div>
                <div style={{ height: '6px', background: 'var(--border-solid)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: isReached ? 'var(--success)' : 'var(--primary-gradient)',
                    borderRadius: '3px',
                    transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
              </div>

              {/* Méta */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                {p.targetDate && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    📅 {new Date(p.targetDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    {monthsLeft !== null && monthsLeft > 0 && ` · ${monthsLeft} mois`}
                  </span>
                )}
                {monthlyNeeded && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: '600' }}>
                    ~{monthlyNeeded.toFixed(0)} €/mois
                  </span>
                )}
                {isReached && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: '700' }}>✓ Objectif atteint</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bouton versement */}
        {!isArchived && (
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '0.5rem 1.1rem' }}>
            <button
              onClick={() => { setContribTarget(showContrib ? null : p.id); setContrib(defaultContrib); }}
              style={{
                fontSize: '0.78rem', fontWeight: '700', color: showContrib ? 'var(--danger)' : 'var(--primary)',
                display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'color 0.15s',
              }}>
              {showContrib ? <><X size={13} /> Annuler</> : <><Plus size={13} /> Ajouter un versement</>}
            </button>

            {/* Formulaire versement inline */}
            <div style={{
              overflow: 'hidden',
              maxHeight: showContrib ? '120px' : '0',
              opacity: showContrib ? 1 : 0,
              transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: '0.65rem' }}>
                <div style={{ flex: '1 1 80px' }}>
                  <label className="label">Montant (€)</label>
                  <input className="input-field" type="number" min="1" step="1" placeholder="200"
                    value={contrib.amount}
                    onChange={e => setContrib(p => ({ ...p, amount: e.target.value }))}
                    style={{ padding: '0.55rem 0.75rem', fontSize: '0.9rem' }} />
                </div>
                <div style={{ flex: '2 1 120px' }}>
                  <label className="label">Note (optionnel)</label>
                  <input className="input-field" placeholder="Ex : virement juillet"
                    value={contrib.note}
                    onChange={e => setContrib(p => ({ ...p, note: e.target.value }))}
                    style={{ padding: '0.55rem 0.75rem', fontSize: '0.9rem' }} />
                </div>
                <button
                  onClick={() => handleAddContrib(p)}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem', flexShrink: 0 }}>
                  Valider
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Historique contributions */}
        {p.contributions?.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : p.id)}
              style={{
                width: '100%', padding: '0.5rem 1.1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span>{p.contributions.length} versement{p.contributions.length > 1 ? 's' : ''}</span>
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <div style={{
              overflow: 'hidden',
              maxHeight: isExpanded ? `${p.contributions.length * 40 + 16}px` : '0',
              transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}>
              <div style={{ padding: '0 1.1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {[...p.contributions].reverse().map((c, ri) => {
                  const realIdx = p.contributions.length - 1 - ri;
                  return (
                    <div key={ri} className="detail-row" style={{ fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ fontWeight: '600' }}>{Number(c.amount).toFixed(0)} €</span>
                        {c.note && <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>— {c.note}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                        <button onClick={() => handleRemoveContrib(p, realIdx)}
                          style={{ color: 'var(--text-muted)', transition: 'color 0.15s', lineHeight: 1, padding: '0.1rem' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Archive */}
        <div style={{ borderTop: '1px solid var(--border-color)', padding: '0.35rem 1.1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => handleArchive(p)}
            style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            {isArchived ? '↩ Réactiver' : 'Archiver'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container animate-fade-in">

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: '400', letterSpacing: '-0.3px', marginBottom: '0.15rem' }}>Projets</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Vos objectifs & enveloppes</p>
        </div>
        <button onClick={showAdd ? closeForm : openAdd} className="btn btn-primary"
          style={{ gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}>
          <Plus size={15} style={{ transition: 'transform 0.25s ease', transform: showAdd && !editingId ? 'rotate(45deg)' : 'none' }} />
          {showAdd && !editingId ? 'Annuler' : 'Nouveau'}
        </button>
      </header>

      {/* Formulaire inline */}
      <InlineForm
        open={showAdd}
        onClose={closeForm}
        title={editingId ? 'Modifier le projet' : 'Nouveau projet'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Enregistrer' : 'Créer'}
      >
        <FormField label="Nom du projet">
          <input id="project-name-input" className="input-field"
            placeholder="Ex : Vacances en Corse" required
            value={form.name} onChange={f('name')} />
        </FormField>

        <FormField label="Icône">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {ICON_KEYS.map(key => {
              const Icon = PROJECT_ICONS[key];
              const isSelected = form.iconKey === key;
              return (
                <button type="button" key={key} title={key}
                  onClick={() => setForm(p => ({ ...p, iconKey: key }))}
                  style={{
                    width: '38px', height: '38px', borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-solid)'}`,
                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  }}>
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <FormField label="Montant cible (€)">
            <input className="input-field" type="number" min="1" step="1" placeholder="2 000"
              required value={form.targetAmount} onChange={f('targetAmount')} />
          </FormField>
          <FormField label="Date cible (optionnel)">
            <input className="input-field" type="month"
              value={form.targetDate} onChange={f('targetDate')} />
          </FormField>
        </div>

        <FormField label="Description (optionnel)">
          <input className="input-field" placeholder="Ex : Vacances de juillet 2026"
            value={form.description} onChange={f('description')} />
        </FormField>
      </InlineForm>

      {/* Récap global */}
      {active.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.1rem' }}>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <span className="label">Total mis de côté</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--primary)', marginTop: '0.2rem' }}>{totalCurrent.toFixed(0)} €</p>
          </div>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <span className="label">Objectif total</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{totalTarget.toFixed(0)} €</p>
          </div>
        </div>
      )}

      {/* Projets actifs */}
      {active.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {active.map(p => <ProjectCard key={p.id} p={p} />)}
        </div>
      ) : !showAdd && (
        <div className="empty-state" style={{ marginBottom: '1.25rem' }}>
          <Plane size={30} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', display: 'block' }} />
          <p style={{ fontWeight: '700', marginBottom: '0.35rem' }}>Aucun projet en cours</p>
          <p style={{ fontSize: '0.85rem' }}>Vacances, travaux, véhicule — créez votre premier objectif.</p>
        </div>
      )}

      {/* Archivés */}
      {archived.length > 0 && (
        <div>
          <p className="label" style={{ marginBottom: '0.6rem', paddingLeft: '0.25rem' }}>Archivés</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {archived.map(p => <ProjectCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

    </div>
  );
};

export default Projects;
