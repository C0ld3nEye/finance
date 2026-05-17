import React, { useState } from 'react';
import { pb } from '../config/pocketbase';
import { LogIn, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await pb.collection('users').authWithPassword(email, password);
    } catch (err) {
      console.error(err);
      setError('Identifiants invalides ou erreur de connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Orbes de fond */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(13,159,110,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-in" style={{
        width: '100%',
        maxWidth: '380px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'var(--primary-gradient)',
            borderRadius: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(13, 159, 110, 0.3)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: '400',
            letterSpacing: '-0.3px',
            color: 'var(--text-primary)',
            marginBottom: '0.4rem',
            lineHeight: 1.2,
          }}>
            Finance Famille
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
            Votre espace de gestion foyer
          </p>
        </div>

        {/* Card formulaire */}
        <div className="card" style={{ padding: '2rem' }}>

          {error && (
            <div style={{
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '1.25rem',
              border: '1px solid rgba(220, 38, 38, 0.15)',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label className="label">Adresse e-mail</label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                placeholder="vous@exemple.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', height: '2.9rem', fontSize: '0.95rem' }}
              disabled={loading}
            >
              {loading
                ? <span style={{ opacity: 0.8 }}>Connexion…</span>
                : <><LogIn size={17} /> Se connecter</>
              }
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontWeight: '500',
        }}>
          Application privée · Accès restreint
        </p>
      </div>
    </div>
  );
};

export default Login;
