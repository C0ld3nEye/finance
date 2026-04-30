import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const col = (householdId) => collection(db, 'households', householdId, 'savings');

export const getSavings = async (householdId) => {
  if (!householdId) return [];
  const snap = await getDocs(col(householdId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addSaving = async (householdId, uid, saving) => {
  const data = { ...saving, userId: uid, createdAt: new Date().toISOString() };
  const ref = await addDoc(col(householdId), data);
  return { id: ref.id, ...data };
};

export const updateSaving = async (householdId, savingId, updates) => {
  await updateDoc(doc(db, 'households', householdId, 'savings', savingId), updates);
};

export const deleteSaving = async (householdId, savingId) => {
  await deleteDoc(doc(db, 'households', householdId, 'savings', savingId));
};
