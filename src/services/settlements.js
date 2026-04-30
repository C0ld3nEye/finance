import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const addSettlement = async (householdId, data) => {
  const ref = await addDoc(collection(db, 'households', householdId, 'settlements'), {
    ...data,
    date: new Date().toISOString(),
  });
  return { id: ref.id, ...data };
};

export const deleteSettlement = async (householdId, settlementId) => {
  await deleteDoc(doc(db, 'households', householdId, 'settlements', settlementId));
};
