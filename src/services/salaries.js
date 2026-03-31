import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'salaries';

export const getMonthlySalaries = async (householdId, year, month) => {
  if (!householdId) return null;
  const id = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  const docRef = doc(db, 'households', householdId, collectionName, id);
  const snap = await getDoc(docRef);
  
  if (snap.exists()) {
    return snap.data();
  }
  return null;
};

export const updateMonthlySalaries = async (householdId, year, month, salaries) => {
  const id = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  const docRef = doc(db, 'households', householdId, collectionName, id);
  await setDoc(docRef, { salaries, year, month, updatedAt: new Date().toISOString() });
};

export const getSalariesForPeriod = async (householdId, year, month) => {
    // Helper to get monthly or fallback to default
    const monthly = await getMonthlySalaries(householdId, year, month);
    return monthly?.salaries || null;
};

export const getAllMonthlySalaries = async (householdId) => {
  if (!householdId) return [];
  const q = query(collection(db, 'households', householdId, collectionName));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
