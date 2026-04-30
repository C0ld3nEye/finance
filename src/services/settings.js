import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'user_profiles', uid));
  return snap.exists() ? snap.data() : null;
};

export const updateUserProfile = async (uid, profile) => {
  await setDoc(doc(db, 'user_profiles', uid), profile, { merge: true });
};

export const getSettings = async (householdId) => {
  if (!householdId) return null;
  const snap = await getDoc(doc(db, 'households', householdId, 'config', 'settings'));
  if (snap.exists()) return snap.data();

  const defaultSettings = {
    members: [
      { id: 'm1', name: 'Personne 1' },
      { id: 'm2', name: 'Personne 2' },
    ],
    accounts: [
      { id: 'a1', name: 'Compte Commun', visibility: 'shared' },
    ],
    accountStartDay: 1, // Jour de début du mois comptable
  };
  await setDoc(doc(db, 'households', householdId, 'config', 'settings'), defaultSettings);
  return defaultSettings;
};

export const updateSettings = async (householdId, newSettings) => {
  await setDoc(doc(db, 'households', householdId, 'config', 'settings'), newSettings);
};
