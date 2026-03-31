import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'charges';

export const getCharges = async (uid) => {
  if (!uid) return [];
  const q = query(collection(db, collectionName), where('userId', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addCharge = async (uid, charge) => {
  const chargeWithUser = { ...charge, userId: uid };
  const docRef = await addDoc(collection(db, collectionName), chargeWithUser);
  return { id: docRef.id, ...chargeWithUser };
};

export const updateCharge = async (id, updates) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, updates);
};

export const deleteCharge = async (id) => {
  await deleteDoc(doc(db, collectionName, id));
};
