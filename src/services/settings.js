import { pb } from '../config/pocketbase';

export const getUserProfile = async (uid) => {
  // Dans PocketBase, le profil est directement sur le modèle auth
  const model = pb.authStore.model;
  if (model && model.id === uid) {
    return { householdId: model.householdId || null };
  }
  return null;
};

export const updateUserProfile = async (uid, profile) => {
  await pb.collection('users').update(uid, profile);
  // Rafraîchir le modèle local
  await pb.collection('users').authRefresh();
};

export const getSettings = async (householdId) => {
  if (!householdId) return null;
  try {
    return await pb.collection('settings').getFirstListItem(`householdId = "${householdId}"`);
  } catch {
    // Crée les paramètres par défaut si inexistants
    const defaultSettings = {
      householdId,
      members: [
        { id: 'm1', name: 'Personne 1' },
        { id: 'm2', name: 'Personne 2' },
      ],
      accounts: [
        { id: 'a1', name: 'Compte Commun', visibility: 'shared' },
      ],
      accountStartDay: 1,
    };
    return await pb.collection('settings').create(defaultSettings);
  }
};

export const updateSettings = async (householdId, newSettings) => {
  try {
    const existing = await pb.collection('settings').getFirstListItem(`householdId = "${householdId}"`);
    await pb.collection('settings').update(existing.id, newSettings);
  } catch {
    await pb.collection('settings').create({ ...newSettings, householdId });
  }
};
