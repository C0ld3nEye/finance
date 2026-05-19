import PocketBase from 'pocketbase';

// URL PocketBase — à adapter si nécessaire
const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(POCKETBASE_URL);

// Désactive l'annulation automatique des requêtes concurrentes
pb.autoCancellation(false);
