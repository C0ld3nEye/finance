import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Wallet, LogIn, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError('Identifiants invalides ou erreur de connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
      padding: '1rem'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            backgroundColor: 'var(--primary)', 
            borderRadius: 'var(--radius-lg)', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white',
            marginBottom: '1rem',
            boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)'
          }}>
            <Wallet size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Finance Famille</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Connectez-vous à votre espace foyer</p>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: 'var(--danger)', 
            padding: '0.75rem 1rem', 
            borderRadius: 'var(--radius-md)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            border: '1px solid #fecaca'
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="label">Adresse Email</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="votre@email.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.5rem', height: '3rem' }}
            disabled={loading}
          >
            {loading ? 'Connexion...' : <><LogIn size={18} /> Se connecter</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Ceci est une application privée de gestion de foyer.
        </p>
      </div>
    </div>
  );
};

export default Login;
