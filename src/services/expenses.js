import { pb } from '../config/pocketbase';

/**
 * Filtre client : une dépense est visible si partagée ou appartient à l'uid.
 */
export const isExpenseVisibleTo = (expense, uid) => {
  if (expense.visibility === 'shared') return true;
  if (expense.userId === uid) return true;
  if (expense.visibility === uid) return true;
  return false;
};

const cleanPayload = (payload) => {
  const clean = { ...payload };
  delete clean.id;
  delete clean.collectionId;
  delete clean.collectionName;
  delete clean.created;
  delete clean.updated;
  delete clean.expand;
  return clean;
};

export const addExpense = async (householdId, uid, expense) => {
  const data = { ...cleanPayload(expense), userId: uid, householdId };
  const record = await pb.collection('expenses').create(data);
  return { id: record.id, ...record };
};

export const updateExpense = async (householdId, expenseId, updates) => {
  await pb.collection('expenses').update(expenseId, cleanPayload(updates));
};

export const deleteExpense = async (householdId, expenseId) => {
  await pb.collection('expenses').delete(expenseId);
};
