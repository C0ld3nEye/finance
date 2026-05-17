import { pb } from '../config/pocketbase';

export const addSettlement = async (householdId, data) => {
  const record = await pb.collection('settlements').create({
    ...data,
    householdId,
    date: new Date().toISOString(),
  });
  return { id: record.id, ...record };
};

export const deleteSettlement = async (householdId, settlementId) => {
  await pb.collection('settlements').delete(settlementId);
};
