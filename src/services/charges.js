import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'charges';

export const getCharges = async (householdId, uid) => {
  if (!householdId) return [];
  const q = query(collection(db, 'households', householdId, collectionName));
  const snapshot = await getDocs(q);
  const allCharges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  return allCharges.filter(c => {
    if (c.visibility === 'shared') return true;
    return c.userId === uid;
  });
};

export const addCharge = async (householdId, uid, charge) => {
  const chargeWithMeta = { ...charge, userId: uid, householdId };
  const docRef = await addDoc(collection(db, 'households', householdId, collectionName), chargeWithMeta);
  return { id: docRef.id, ...chargeWithMeta };
};

export const updateCharge = async (householdId, chargeId, updates) => {
  const docRef = doc(db, 'households', householdId, collectionName, chargeId);
  await updateDoc(docRef, updates);
};

export const getAllCharges = async (householdId, uid) => {
  if (!uid || !householdId) return [];
  const q = query(
    collection(db, 'households', householdId, collectionName),
    where('visibility', 'in', ['shared', uid])
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteCharge = async (householdId, id) => {
  const docRef = doc(db, 'households', householdId, collectionName, id);
  await deleteDoc(docRef);
};
