import { useEffect, useState, useRef } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Hook central de données temps réel.
 * Ouvre des listeners onSnapshot sur toutes les sous-collections du foyer.
 * Chaque membre voit les mises à jour instantanément sans recharger.
 */
export const useHouseholdData = (householdId) => {
  const [charges, setCharges] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [savings, setSavings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const unsubs = useRef([]);

  useEffect(() => {
    if (!householdId) { setLoading(false); return; }

    unsubs.current.forEach(fn => fn());
    unsubs.current = [];
    setLoading(true);

    let loadedCount = 0;
    const TOTAL = 7;
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= TOTAL) setLoading(false);
    };

    const listenCol = (subCol, setter) => {
      const q = query(collection(db, 'households', householdId, subCol));
      const unsub = onSnapshot(q, snap => {
        setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        markLoaded();
      }, err => { console.error('onSnapshot error', subCol, err); markLoaded(); });
      unsubs.current.push(unsub);
    };

    // Settings : document unique
    const settingsRef = doc(db, 'households', householdId, 'config', 'settings');
    const unsubSettings = onSnapshot(settingsRef, snap => {
      if (snap.exists()) setSettings(snap.data());
      markLoaded();
    }, err => { console.error('onSnapshot error settings', err); markLoaded(); });
    unsubs.current.push(unsubSettings);

    listenCol('charges',     setCharges);
    listenCol('expenses',    setExpenses);
    listenCol('settlements', setSettlements);
    listenCol('savings',     setSavings);
    listenCol('projects',    setProjects);
    listenCol('salaries',    setSalaries);

    return () => { unsubs.current.forEach(fn => fn()); };
  }, [householdId]);

  return { charges, expenses, settlements, savings, projects, salaries, settings, loading };
};
