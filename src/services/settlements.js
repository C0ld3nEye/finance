import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'settlements';

export const getSettlements = async (householdId, year, month) => {
  if (!householdId) return [];
  const q = query(
    collection(db, 'households', householdId, collectionName),
    where('year', '==', year),
    where('month', '==', month)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addSettlement = async (householdId, data) => {
  const docRef = await addDoc(collection(db, 'households', householdId, collectionName), {
    ...data,
    date: new Date().toISOString()
  });
  return { id: docRef.id, ...data };
};

export const deleteSettlement = async (householdId, settlementId) => {
  await deleteDoc(doc(db, 'households', householdId, collectionName, settlementId));
};

export const getAllSettlements = async (householdId) => {
  if (!householdId) return [];
  const q = query(collection(db, 'households', householdId, collectionName));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
