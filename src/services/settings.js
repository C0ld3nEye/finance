import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_DOC_ID = 'household_settings';

export const getSettings = async () => {
  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
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
      { id: 'a1', name: 'Compte Commun' },
      { id: 'a2', name: 'Compte Perso 1' },
      { id: 'a3', name: 'Compte Perso 2' }
    ]
  };
  await setDoc(docRef, defaultSettings);
  return defaultSettings;
};

export const updateSettings = async (newSettings) => {
  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
  await updateDoc(docRef, newSettings);
};
