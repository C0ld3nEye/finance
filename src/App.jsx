import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { getUserProfile } from './services/settings';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Charges from './pages/Charges';
import Salaries from './pages/Salaries';
import Debts from './pages/Debts';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { ConfirmProvider } from './context/ConfirmContext';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Thème dynamique Nuit / Jour (Nuit: 19h - 07h)
  useEffect(() => {
    const checkTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 19 || hour < 7) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
    };
    checkTheme();
    const interval = setInterval(checkTheme, 60000); // Vérifie chaque minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        if (profile?.householdId) {
          setHouseholdId(profile.householdId);
        }
      } else {
        setHouseholdId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
// ...
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center' }}>
           <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Chargement sécurisé...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }
  return (
    <ConfirmProvider>
      <Router>
        <div className="app-container">
          <Sidebar />
          <main className="main-content animate-fade-in">
            <Routes>
              {!householdId ? (
                <>
                  <Route path="/settings" element={<Settings householdId={householdId} onHouseholdUpdate={setHouseholdId} />} />
                  <Route path="*" element={<Navigate to="/settings" replace />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard householdId={householdId} />} />
                  <Route path="/expenses" element={<Expenses householdId={householdId} />} />
                  <Route path="/charges" element={<Charges householdId={householdId} />} />
                  <Route path="/salaries" element={<Salaries householdId={householdId} />} />
                  <Route path="/debts" element={<Debts householdId={householdId} />} />
                  <Route path="/settings" element={<Settings householdId={householdId} onHouseholdUpdate={setHouseholdId} />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </>
              )}
            </Routes>
          </main>
        </div>
      </Router>
    </ConfirmProvider>
  );
}

export default App;
