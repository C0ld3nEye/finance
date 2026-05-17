const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Chemin vers la clé de service téléchargée
const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ERREUR : Le fichier service-account.json est introuvable.");
  console.error("Veuillez le télécharger depuis Firebase Console > Paramètres du projet > Comptes de service.");
  console.error("Et placez-le dans le dossier 'scripts' sous le nom 'service-account.json'.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportAllData() {
  console.log("⏳ Début de l'export des données Firebase...");
  const backup = { exportedAt: new Date().toISOString() };

  try {
    // On cherche d'abord l'ID du foyer
    console.log("🔍 Recherche du foyer...");
    const householdsSnap = await db.collection('households').get();
    
    if (householdsSnap.empty) {
      console.error("❌ Aucun foyer trouvé dans Firestore.");
      process.exit(1);
    }
    
    // On prend le premier foyer (en général il n'y en a qu'un)
    const householdId = householdsSnap.docs[0].id;
    backup.householdId = householdId;
    console.log(`✅ Foyer trouvé : ${householdId}`);

    // Récupérer les Settings
    console.log("⚙️  Export des paramètres...");
    const settingsSnap = await db.collection('households').doc(householdId).collection('config').doc('settings').get();
    backup.settings = settingsSnap.exists ? settingsSnap.data() : null;

    // Récupérer toutes les sous-collections
    const collections = ['expenses', 'charges', 'settlements', 'savings', 'projects', 'salaries'];
    
    for (const colName of collections) {
      console.log(`📦 Export de la collection : ${colName}...`);
      const snap = await db.collection('households').doc(householdId).collection(colName).get();
      backup[colName] = snap.docs.map(doc => ({ _firebaseId: doc.id, ...doc.data() }));
      console.log(`   -> ${snap.size} documents exportés.`);
    }

    // Sauvegarde dans un fichier JSON
    const backupPath = path.join(__dirname, 'backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log("\n🎉 EXPORT RÉUSSI !");
    console.log(`Fichier sauvegardé ici : ${backupPath}`);
    
  } catch (error) {
    console.error("❌ Erreur lors de l'export :", error);
  }
}

exportAllData();
