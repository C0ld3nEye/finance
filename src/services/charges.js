import { pb } from '../config/pocketbase';

/**
 * Filtre client : une charge est visible si elle est partagée ou appartient à l'uid.
 */
export const isChargeVisibleTo = (charge, uid) => {
  if (charge.visibility === 'shared') return true;
  if (charge.userId === uid) return true;
  if (charge.visibility === uid) return true;
  return false;
};

export const addCharge = async (householdId, uid, charge) => {
  const data = { ...charge, userId: uid, householdId };
  const record = await pb.collection('charges').create(data);
  return { id: record.id, ...record };
};

export const updateCharge = async (householdId, chargeId, updates) => {
  await pb.collection('charges').update(chargeId, updates);
};

export const deleteCharge = async (householdId, chargeId) => {
  await pb.collection('charges').delete(chargeId);
};
