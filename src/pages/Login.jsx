import React, { useState } from 'react';
import { pb } from '../config/pocketbase';
import { LogIn, AlertCircle, UserPlus } from 'lucide-react';

const Login = () => {
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [passwordConf,  setPasswordConf]  = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        if (password !== passwordConf) {
          throw new Error("Les mots de passe ne correspondent pas.");
        }
        if (password.length < 10) {
          throw new Error("Le mot de passe doit faire au moins 10 caractères.");
        }
        // Création du compte
        await pb.collection('users').create({
          email,
          password,
          passwordConfirm: passwordConf,
        });
        // Connexion automatique après création
        await pb.collection('users').authWithPassword(email, password);
      } else {
        // Connexion standard
        await pb.collection('users').authWithPassword(email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.message) {
        setError(err.message.includes('Failed to authenticate') ? 'Identifiants invalides.' : err.message);
      } else {
        setError('Une erreur est survenue.');
      }
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
            {isRegistering ? 'Créez votre compte foyer' : 'Votre espace de gestion foyer'}
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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
              <label className="label">Mot de passe {isRegistering && '(min. 10 car.)'}</label>
              <input
                id="login-password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isRegistering ? 10 : undefined}
              />
            </div>

            {isRegistering && (
              <div className="animate-fade-in">
                <label className="label">Confirmer le mot de passe</label>
                <input
                  id="login-password-conf"
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  required
                  value={passwordConf}
                  onChange={(e) => setPasswordConf(e.target.value)}
                  minLength={10}
                />
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', height: '2.9rem', fontSize: '0.95rem' }}
              disabled={loading}
            >
              {loading
                ? <span style={{ opacity: 0.8 }}>{isRegistering ? 'Création...' : 'Connexion...'}</span>
                : <>{isRegistering ? <UserPlus size={17} /> : <LogIn size={17} />} {isRegistering ? 'Créer mon compte' : 'Se connecter'}</>
              }
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              type="button" 
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              {isRegistering ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
            </button>
          </div>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontWeight: '500',
        }}>
          Application privée · Accès sécurisé PocketBase
        </p>
      </div>
    </div>
  );
};

export default Login;
