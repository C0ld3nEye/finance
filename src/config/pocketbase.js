import PocketBase from 'pocketbase';

// URL PocketBase — à adapter si nécessaire
const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Gestion des URLs relatives pour le Reverse Proxy
const getPocketBaseUrl = () => {
  if (POCKETBASE_URL.startsWith('/')) {
    return window.location.origin + POCKETBASE_URL;
  }
  return POCKETBASE_URL;
};

export const pb = new PocketBase(getPocketBaseUrl());

// Désactive l'annulation automatique des requêtes concurrentes
pb.autoCancellation(false);
