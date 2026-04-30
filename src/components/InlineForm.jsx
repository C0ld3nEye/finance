import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Formulaire inline animé — s'insère dans la page et pousse le contenu vers le bas.
 * Usage :
 *   <InlineForm open={showForm} onClose={() => setShowForm(false)} title="Nouvelle épargne">
 *     <div>...champs...</div>
 *   </InlineForm>
 */
const InlineForm = ({ open, onClose, title, children, onSubmit, submitLabel = 'Enregistrer' }) => {
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // On force le rendu visible pour mesurer, puis on anime
      setVisible(true);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          setHeight(containerRef.current.scrollHeight);
        }
      });
    } else {
      setHeight(0);
      // On retire du DOM après l'animation
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Recalcule la hauteur si le contenu change (ex: champs conditionnels)
  useEffect(() => {
    if (open && containerRef.current) {
      const observer = new ResizeObserver(() => {
        if (containerRef.current) setHeight(containerRef.current.scrollHeight);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [open, visible]);

  if (!visible && !open) return null;

  return (
    <div
      style={{
        overflow: 'hidden',
        height: `${height}px`,
        transition: 'height 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'height',
      }}
    >
      <div
        ref={containerRef}
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Card formulaire */}
        <div style={{
          background: 'var(--surface-solid)',
          border: '1.5px solid var(--primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 4px 24px rgba(13,159,110,0.1), 0 1px 4px rgba(0,0,0,0.04)',
          marginBottom: '0.875rem',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid var(--border-solid)',
          }}>
            <h3 style={{
              fontWeight: '700',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--primary-gradient)',
                flexShrink: 0,
              }} />
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              style={{
                color: 'var(--text-muted)',
                padding: '0.3rem',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--danger-light)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={onSubmit}>
            <div style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {children}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.6rem',
              padding: '0.75rem 1.25rem 1rem',
              borderTop: '1px solid var(--border-solid)',
              background: 'var(--bg-subtle)',
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border-solid)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-solid)'}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.875rem', borderRadius: 'var(--radius-md)' }}
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/**
 * Champ de formulaire stylisé avec label uppercase
 */
export const FormField = ({ label, children, hint }) => (
  <div>
    {label && <label className="label" style={{ marginBottom: '0.4rem' }}>{label}</label>}
    {children}
    {hint && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{hint}</p>}
  </div>
);

/**
 * Groupe de boutons toggle (remplace les <select> basiques)
 */
export const ToggleGroup = ({ options, value, onChange }) => (
  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
    {options.map(opt => (
      <button
        type="button"
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          flex: '1 1 auto',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          border: `1.5px solid ${value === opt.value ? 'var(--primary)' : 'var(--border-solid)'}`,
          background: value === opt.value ? 'var(--primary-light)' : 'transparent',
          color: value === opt.value ? 'var(--primary)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: '600',
          fontSize: '0.82rem',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {opt.icon && <span style={{ marginRight: '0.3rem' }}>{opt.icon}</span>}
        {opt.label}
        {opt.desc && (
          <div style={{ fontSize: '0.68rem', fontWeight: '400', opacity: 0.75, marginTop: '1px' }}>{opt.desc}</div>
        )}
      </button>
    ))}
  </div>
);

export default InlineForm;
