import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Filtre client : une dépense est visible si partagée ou appartient à l'uid.
 */
export const isExpenseVisibleTo = (expense, uid) => {
  if (expense.visibility === 'shared') return true;
  if (expense.userId === uid) return true;
  if (expense.visibility === uid) return true;
  return false;
};

export const addExpense = async (householdId, uid, expense) => {
  const data = { ...expense, userId: uid, householdId };
  const ref = await addDoc(collection(db, 'households', householdId, 'expenses'), data);
  return { id: ref.id, ...data };
};

export const updateExpense = async (householdId, expenseId, updates) => {
  await updateDoc(doc(db, 'households', householdId, 'expenses', expenseId), updates);
};

export const deleteExpense = async (householdId, expenseId) => {
  await deleteDoc(doc(db, 'households', householdId, 'expenses', expenseId));
};
