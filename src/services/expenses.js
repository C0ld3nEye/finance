import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

const collectionName = 'expenses';

export const getExpensesByMonth = async (householdId, uid, year, month) => {
  if (!householdId) return [];
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  const q = query(
    collection(db, 'households', householdId, collectionName),
    where('date', '>=', startDate.toISOString()),
    where('date', '<=', endDate.toISOString()),
    orderBy('date', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const allExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Client-side filtering for visibility
  return allExpenses.filter(exp => {
    if (exp.visibility === 'shared') return true;
    return exp.userId === uid;
  });
};

export const addExpense = async (householdId, uid, expense) => {
  const expenseWithMeta = { ...expense, userId: uid, householdId };
  const docRef = await addDoc(collection(db, 'households', householdId, collectionName), expenseWithMeta);
  return { id: docRef.id, ...expenseWithMeta };
};

export const updateExpense = async (householdId, expenseId, updates) => {
  const docRef = doc(db, 'households', householdId, collectionName, expenseId);
  await updateDoc(docRef, updates);
};

export const getAllExpenses = async (householdId, uid) => {
  if (!uid || !householdId) return [];
  const q = query(
    collection(db, 'households', householdId, collectionName),
    where('visibility', 'in', ['shared', uid])
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteExpense = async (householdId, id) => {
  const docRef = doc(db, 'households', householdId, collectionName, id);
  await deleteDoc(docRef);
};
