import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const col = (householdId) => collection(db, 'households', householdId, 'charges');

/**
 * Filtre client : une charge est visible si elle est partagée ou appartient à l'uid.
 */
export const isChargeVisibleTo = (charge, uid) => {
  if (charge.visibility === 'shared') return true;
  if (charge.userId === uid) return true;
  if (charge.visibility === uid) return true;
  return false;
};

export const addCharge = async (householdId, uid, charge) => {
  const data = { ...charge, userId: uid, householdId };
  const ref = await addDoc(col(householdId), data);
  return { id: ref.id, ...data };
};

export const updateCharge = async (householdId, chargeId, updates) => {
  await updateDoc(doc(db, 'households', householdId, 'charges', chargeId), updates);
};

export const deleteCharge = async (householdId, chargeId) => {
  await deleteDoc(doc(db, 'households', householdId, 'charges', chargeId));
};
