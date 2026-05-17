import { useEffect, useState, useRef } from 'react';
import { pb } from '../config/pocketbase';
import { getSettings as fetchOrCreateSettings } from '../services/settings';

/**
 * Hook central de données temps réel.
 * Utilise PocketBase SSE (Server-Sent Events) pour les mises à jour en direct,
 * en remplacement des listeners onSnapshot de Firestore.
 */
export const useHouseholdData = (householdId) => {
  const [charges,     setCharges]     = useState([]);
  const [expenses,    setExpenses]    = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [savings,     setSavings]     = useState([]);
  const [projects,    setProjects]    = useState([]);
  const [salaries,    setSalaries]    = useState([]);
  const [settings,    setSettings]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  const unsubs = useRef([]);

  useEffect(() => {
    if (!householdId) { setLoading(false); return; }

    // Nettoyage des abonnements précédents
    unsubs.current.forEach(fn => { try { fn(); } catch (_) {} });
    unsubs.current = [];
    setLoading(true);

    let loadedCount = 0;
    const TOTAL = 7;
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= TOTAL) setLoading(false);
    };

    /**
     * Charge une collection en entier puis s'abonne aux changements SSE.
     * Applique les événements create/update/delete localement sans re-fetch.
     */
    const listenCol = async (colName, setter) => {
      const f = `householdId = "${householdId}"`;

      // Chargement initial
      try {
        const records = await pb.collection(colName).getFullList({ filter: f });
        setter(records);
      } catch (err) {
        console.error('Fetch error', colName, err);
        setter([]);
      }
      markLoaded();

      // Abonnement SSE temps réel
      try {
        const unsubFn = await pb.collection(colName).subscribe('*', (e) => {
          if (e.record.householdId !== householdId) return;
          setter(prev => {
            if (e.action === 'create') return [...prev, e.record];
            if (e.action === 'update') return prev.map(r => r.id === e.record.id ? e.record : r);
            if (e.action === 'delete') return prev.filter(r => r.id !== e.record.id);
            return prev;
          });
        });
        unsubs.current.push(unsubFn);
      } catch (err) {
        console.error('Subscribe error', colName, err);
      }
    };

    // Settings : document unique par foyer
    const listenSettings = async () => {
      try {
        const record = await fetchOrCreateSettings(householdId);
        setSettings(record);
      } catch (err) {
        console.error('Settings init error', err);
        setSettings(null);
      }
      markLoaded();

      try {
        const unsubFn = await pb.collection('settings').subscribe('*', (e) => {
          if (e.record.householdId !== householdId) return;
          if (e.action === 'delete') setSettings(null);
          else setSettings(e.record);
        });
        unsubs.current.push(unsubFn);
      } catch (err) {
        console.error('Subscribe error settings', err);
      }
    };

    listenSettings();
    listenCol('charges',     setCharges);
    listenCol('expenses',    setExpenses);
    listenCol('settlements', setSettlements);
    listenCol('savings',     setSavings);
    listenCol('projects',    setProjects);
    listenCol('salaries',    setSalaries);

    return () => {
      unsubs.current.forEach(fn => { try { fn(); } catch (_) {} });
    };
  }, [householdId]);

  return { charges, expenses, settlements, savings, projects, salaries, settings, loading };
};
