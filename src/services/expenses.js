import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'expenses';

export const getExpensesByMonth = async (year, month) => {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  const q = query(
    collection(db, collectionName),
    where('date', '>=', startDate.toISOString()),
    where('date', '<=', endDate.toISOString()),
    orderBy('date', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addExpense = async (expense) => {
  const docRef = await addDoc(collection(db, collectionName), expense);
  return { id: docRef.id, ...expense };
};

export const updateExpense = async (id, updates) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, updates);
};

export const deleteExpense = async (id) => {
  await deleteDoc(doc(db, collectionName, id));
};
