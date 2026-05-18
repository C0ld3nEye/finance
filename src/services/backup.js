import { pb } from '../config/pocketbase';

/**
 * Exporte l'intégralité des données du foyer dans un fichier JSON téléchargeable.
 * @param {string} householdId - L'identifiant du foyer à exporter.
 */
export const exportHouseholdData = async (householdId) => {
  if (!householdId) throw new Error("Identifiant du foyer manquant.");

  const filter = `householdId = "${householdId}"`;

  try {
    // 1. Récupération séquentielle de toutes les données du foyer
    const [settingsList, expenses, charges, settlements, savings, projects, salaries] = await Promise.all([
      pb.collection('settings').getFullList({ filter }),
      pb.collection('expenses').getFullList({ filter }),
      pb.collection('charges').getFullList({ filter }),
      pb.collection('settlements').getFullList({ filter }),
      pb.collection('savings').getFullList({ filter }),
      pb.collection('projects').getFullList({ filter }),
      pb.collection('salaries').getFullList({ filter }),
    ]);

    // On s'attend à un unique document de paramètres
    const settings = settingsList[0] || null;

    // 2. Structuration du document d'export
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      householdId,
      data: {
        settings,
        expenses,
        charges,
        settlements,
        savings,
        projects,
        salaries,
      },
    };

    // 3. Déclenchement du téléchargement navigateur
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const safeHId = householdId.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    
    link.href = url;
    link.download = `sauvegarde_finance_${safeHId}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Nettoyage
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Erreur lors de l'export des données :", err);
    throw new Error("Impossible d'exporter les données du foyer.");
  }
};

/**
 * Nettoie un enregistrement pour l'insertion PocketBase en retirant les champs système.
 */
const sanitizeForInsert = (record) => {
  if (!record) return null;
  const { created, updated, collectionId, collectionName, expand, ...sanitized } = record;
  return sanitized;
};

/**
 * Importe un fichier de sauvegarde JSON pour restaurer l'état du foyer.
 * Cette opération écrase les données actuelles du foyer.
 * @param {string} householdId - L'identifiant du foyer actif.
 * @param {object} backup - Les données JSON de sauvegarde.
 */
export const importHouseholdData = async (householdId, backup) => {
  if (!householdId) throw new Error("Identifiant du foyer manquant.");
  if (!backup || backup.version !== '1.0' || !backup.data) {
    throw new Error("Format de fichier de sauvegarde invalide ou version non supportée.");
  }
  if (backup.householdId !== householdId) {
    throw new Error(`Le foyer de la sauvegarde (${backup.householdId}) ne correspond pas au foyer actuel (${householdId}).`);
  }

  const filter = `householdId = "${householdId}"`;
  const collections = ['expenses', 'charges', 'settlements', 'savings', 'projects', 'salaries', 'settings'];

  try {
    // 1. Suppression complète des données existantes du foyer en base pour éviter les doublons
    for (const col of collections) {
      const existing = await pb.collection(col).getFullList({ filter });
      for (const rec of existing) {
        await pb.collection(col).delete(rec.id);
      }
    }

    // 2. Ré-insertion des données de sauvegarde
    const data = backup.data;

    // Insertion des paramètres (settings)
    if (data.settings) {
      const cleanSettings = sanitizeForInsert(data.settings);
      if (cleanSettings) {
        await pb.collection('settings').create(cleanSettings);
      }
    }

    // Insertion séquentielle des autres collections
    const listCollections = ['expenses', 'charges', 'settlements', 'savings', 'projects', 'salaries'];
    for (const col of listCollections) {
      const records = data[col] || [];
      for (const rec of records) {
        const cleanRec = sanitizeForInsert(rec);
        if (cleanRec) {
          await pb.collection(col).create(cleanRec);
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de l'importation de la sauvegarde :", err);
    throw new Error("Échec de la restauration de la sauvegarde. Certaines données peuvent être incomplètes.");
  }
};
