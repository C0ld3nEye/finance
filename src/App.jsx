import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { pb } from './config/pocketbase';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Charges from './pages/Charges';
import Salaries from './pages/Salaries';
import Debts from './pages/Debts';
import Settings from './pages/Settings';
import Savings from './pages/Savings';
import Projects from './pages/Projects';
import Login from './pages/Login';
import { ConfirmProvider } from './context/ConfirmContext';
import { GlobalSkeleton } from './components/SkeletonLoader';
import './index.css';

function App() {
  const [user,        setUser]        = useState(pb.authStore.isValid ? pb.authStore.model : null);
  const [householdId, setHouseholdId] = useState(pb.authStore.isValid ? (pb.authStore.model?.householdId || null) : null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    // Thème automatique selon l'heure
    const checkTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 19 || hour < 7) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
    };
    checkTheme();
    const interval = setInterval(checkTheme, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (pb.authStore.isValid) {
        try {
          // Rafraîchir les infos depuis le serveur pour être sûr d'avoir le householdId à jour
          const res = await pb.collection('users').authRefresh();
          setUser(res.record || pb.authStore.model);
          setHouseholdId(res.record?.householdId || pb.authStore.model?.householdId || null);
        } catch (err) {
          console.error("Erreur de rafraîchissement auth au démarrage:", err);
          setUser(pb.authStore.model);
          setHouseholdId(pb.authStore.model?.householdId || null);
        }
      }
      setLoading(false);
    };

    initAuth();

    // Écouter les changements d'état d'authentification PocketBase
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
      setHouseholdId(model?.householdId || null);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <GlobalSkeleton />;
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
                  <Route path="/expenses"  element={<Expenses  householdId={householdId} />} />
                  <Route path="/charges"   element={<Charges   householdId={householdId} />} />
                  <Route path="/salaries"  element={<Salaries  householdId={householdId} />} />
                  <Route path="/debts"     element={<Debts     householdId={householdId} />} />
                  <Route path="/savings"   element={<Savings   householdId={householdId} />} />
                  <Route path="/projects"  element={<Projects  householdId={householdId} />} />
                  <Route path="/settings"  element={<Settings  householdId={householdId} onHouseholdUpdate={setHouseholdId} />} />
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
