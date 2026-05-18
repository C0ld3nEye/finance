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

export const addCharge = async (householdId, uid, charge) => {
  const data = { ...cleanPayload(charge), userId: uid, householdId };
  const record = await pb.collection('charges').create(data);
  return { id: record.id, ...record };
};

export const updateCharge = async (householdId, chargeId, updates) => {
  await pb.collection('charges').update(chargeId, cleanPayload(updates));
};

export const deleteCharge = async (householdId, chargeId) => {
  await pb.collection('charges').delete(chargeId);
};
