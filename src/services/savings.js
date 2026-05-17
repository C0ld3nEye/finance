import { pb } from '../config/pocketbase';

const filter = (householdId) => `householdId = "${householdId}"`;

export const getSavings = async (householdId) => {
  if (!householdId) return [];
  return await pb.collection('savings').getFullList({ filter: filter(householdId) });
};

export const addSaving = async (householdId, uid, saving) => {
  const data = { ...saving, userId: uid, householdId, createdAt: new Date().toISOString() };
  const record = await pb.collection('savings').create(data);
  return { id: record.id, ...record };
};

export const updateSaving = async (householdId, savingId, updates) => {
  await pb.collection('savings').update(savingId, updates);
};

export const deleteSaving = async (householdId, savingId) => {
  await pb.collection('savings').delete(savingId);
};
