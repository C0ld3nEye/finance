import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'charges';

export const getCharges = async () => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addCharge = async (charge) => {
  const docRef = await addDoc(collection(db, collectionName), charge);
  return { id: docRef.id, ...charge };
};

export const updateCharge = async (id, updates) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, updates);
};

export const deleteCharge = async (id) => {
  await deleteDoc(doc(db, collectionName, id));
};
