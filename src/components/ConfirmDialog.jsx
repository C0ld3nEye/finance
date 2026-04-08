import React from 'react';
import { AlertTriangle, Info, Trash2, Save, LogOut, Settings, AlertCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

const ConfirmDialog = ({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title = 'Confirmation', 
  message = 'Êtes-vous sûr ?',
  subMessage = null,
  confirmText = 'Confirmer', 
  cancelText = 'Annuler',
  variant = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  icon = null
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    warning: {
      iconBg: 'var(--warning-light)',
      iconColor: 'var(--warning)',
      btnBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      btnShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
    },
    danger: {
      iconBg: 'var(--danger-light)',
      iconColor: 'var(--danger)',
      btnBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      btnShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    },
    info: {
      iconBg: 'var(--primary-light)',
      iconColor: 'var(--primary)',
      btnBg: 'var(--primary-gradient)',
      btnShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    },
    success: {
      iconBg: '#dcfce7',
      iconColor: '#166534',
      btnBg: 'linear-gradient(135deg, #10b981, #059669)',
      btnShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    },
  };

  const icons = {
    delete: Trash2,
    save: Save,
    logout: LogOut,
    settings: Settings,
    info: Info,
    warning: AlertTriangle,
    error: AlertCircle,
    help: HelpCircle,
    success: CheckCircle2
  };

  const v = variantStyles[variant] || variantStyles.warning;
  const FinalIcon = icon && icons[icon] ? icons[icon] : (variant === 'info' ? Info : (variant === 'success' ? CheckCircle2 : AlertTriangle));

  return (
    <div 
      className="modal-overlay" 
      onClick={onCancel}
      style={{ zIndex: 3000 }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-color)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-glass)',
          padding: '2rem',
          animation: 'modalScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          textAlign: 'center',
        }}
      >
        {/* Icône */}
        <div style={{
          width: '3.5rem', height: '3.5rem',
          borderRadius: '50%',
          backgroundColor: v.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <FinalIcon size={24} color={v.iconColor} />
        </div>

        {/* Titre */}
        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: '0.75rem',
        }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          marginBottom: subMessage ? '0.5rem' : '1.75rem',
        }}>
          {message}
        </p>

        {/* Sous-message optionnel */}
        {subMessage && (
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            marginBottom: '1.75rem',
            opacity: 0.7,
            fontStyle: 'italic',
          }}>
            {subMessage}
          </p>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {cancelText && (
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: v.btnBg,
              color: '#fff',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: v.btnShadow,
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
