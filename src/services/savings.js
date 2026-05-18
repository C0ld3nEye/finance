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

export const updateSaving = async (householdId, savingId, updates) => {
  await pb.collection('savings').update(savingId, cleanPayload(updates));
};

export const deleteSaving = async (householdId, savingId) => {
  await pb.collection('savings').delete(savingId);
};
