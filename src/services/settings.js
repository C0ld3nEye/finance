import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_DOC_ID = 'household_settings';

export const getUserProfile = async (uid) => {
  const docRef = doc(db, 'user_profiles', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateUserProfile = async (uid, profile) => {
  const docRef = doc(db, 'user_profiles', uid);
  await setDoc(docRef, profile, { merge: true });
};

export const getSettings = async (householdId) => {
  if (!householdId) return null;
  const docRef = doc(db, 'households', householdId, 'config', 'settings');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  
  const defaultSettings = {
    members: [
      { id: 'm1', name: 'Personne 1', salary: 2000 },
      { id: 'm2', name: 'Personne 2', salary: 2000 }
    ],
    accounts: [
      { id: 'a1', name: 'Compte Commun', visibility: 'shared' },
      { id: 'a2', name: 'Compte Perso', visibility: 'private' }
    ]
  };
  await setDoc(docRef, defaultSettings);
  return defaultSettings;
};

export const updateSettings = async (householdId, newSettings) => {
  const docRef = doc(db, 'households', householdId, 'config', 'settings');
  await setDoc(docRef, newSettings);
};
