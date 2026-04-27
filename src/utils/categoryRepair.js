import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const CATEGORY_MAPPING = {
  'Alimentation': ['course', 'carrefour', 'leclerc', 'lidl', 'monoprix', 'boulangerie', 'picard', 'resto', 'intermarche', 'super u', 'aldi', 'franprix', 'casino', 'auchan', 'mcdo', 'burger king', 'pizza', 'deliveroo', 'uber eats'],
  'Logement':     ['loyer', 'credit', 'pret immo', 'edf', 'engie', 'eau', 'habitation', 'copro'],
  'Transport':    ['essence', 'total', 'esso', 'peage', 'parking', 'sncf', 'train', 'bus', 'metro', 'ratp', 'voiture', 'garage'],
  'Abonnements':  ['netflix', 'spotify', 'amazon', 'prime', 'internet', 'box', 'sfr', 'orange', 'bouygues', 'free', 'telephone', 'canal', 'deezer', 'icloud', 'disney'],
  'Santé':        ['pharmacie', 'medecin', 'mutuelle', 'dentiste', 'opticien', 'doctolib'],
  'Loisirs':      ['cine', 'cinema', 'jeu', 'steam', 'playstation', 'nintendo', 'sortie', 'parc'],
  'Cadeaux':      ['cadeau', 'anniversaire', 'noel'],
  'Animaux':      ['veto', 'veterinaire', 'croquettes', 'chien', 'chat', 'maxizoo'],
  'Sport':        ['gym', 'fitness', 'club', 'sport', 'tennis', 'foot', 'piscine'],
};

/**
 * Tente de deviner la catégorie d'un libellé à partir du mapping de mots-clés.
 * @param {string} label - Description ou nom de la transaction.
 * @returns {string|null} Catégorie trouvée, ou null.
 */
export const guessCategory = (label) => {
  const normalized = (label || '').toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAPPING)) {
    if (keywords.some(k => normalized.includes(k))) return cat;
  }
  return null;
};

/**
 * Parcourt une collection Firestore et met à jour les documents
 * sans catégorie (ou catégorisés "Autre") via le mapping de mots-clés.
 *
 * @param {string} householdId
 * @param {'expenses'|'charges'} collectionName
 * @returns {Promise<number>} Nombre de documents mis à jour.
 */
const repairCollection = async (householdId, collectionName) => {
  const snap = await getDocs(collection(db, 'households', householdId, collectionName));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (!data.category || data.category === 'Autre') {
      const guessed = guessCategory(data.description || data.name);
      if (guessed) {
        await updateDoc(d.ref, { category: guessed });
        count++;
      }
    }
  }
  return count;
};

/**
 * Répare les catégories manquantes sur dépenses ET charges.
 * @param {string} householdId
 * @returns {Promise<number>} Nombre total de documents mis à jour.
 */
export const repairAllCategories = async (householdId) => {
  const [expCount, charCount] = await Promise.all([
    repairCollection(householdId, 'expenses'),
    repairCollection(householdId, 'charges'),
  ]);
  return expCount + charCount;
};
