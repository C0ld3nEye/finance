const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyAokxdJX-47uXEe4tzYj6Vb0dYjp3Mdig0",
  authDomain: "meal-planer-d8184.firebaseapp.com",
  databaseURL: "https://meal-planer-d8184-default-rtdb.firebaseio.com",
  projectId: "meal-planer-d8184",
  storageBucket: "meal-planer-d8184.firebasestorage.app",
  messagingSenderId: "6386360698",
  appId: "1:6386360698:web:c14bedf626edd9238d76c3"
};

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("❌ ERREUR : Il manque vos identifiants de l'application.");
  console.error("Utilisation : node export-firebase-client.js <votre_email> <votre_mot_de_passe>");
  process.exit(1);
}

const [email, password] = args;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function exportData() {
  try {
    console.log(`🔐 Connexion à Firebase en tant que ${email}...`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    console.log(`✅ Connecté avec succès ! (UID: ${uid})`);

    console.log("🔍 Recherche de votre profil pour trouver le Foyer (Household)...");
    const profileSnap = await getDoc(doc(db, 'user_profiles', uid));
    if (!profileSnap.exists()) {
      console.error("❌ Impossible de trouver le profil utilisateur.");
      process.exit(1);
    }

    const householdId = profileSnap.data().householdId;
    if (!householdId) {
      console.error("❌ Vous n'êtes rattaché à aucun foyer.");
      process.exit(1);
    }
    console.log(`✅ Foyer trouvé : ${householdId}`);

    const backup = { householdId, exportedAt: new Date().toISOString() };

    console.log("⚙️  Export des paramètres...");
    const settingsSnap = await getDoc(doc(db, 'households', householdId, 'config', 'settings'));
    backup.settings = settingsSnap.exists() ? settingsSnap.data() : null;

    const collections = ['expenses', 'charges', 'settlements', 'savings', 'projects', 'salaries'];
    for (const colName of collections) {
      console.log(`📦 Export de la collection : ${colName}...`);
      const snap = await getDocs(collection(db, 'households', householdId, colName));
      backup[colName] = snap.docs.map(d => ({ _firebaseId: d.id, ...d.data() }));
      console.log(`   -> ${snap.size} documents exportés.`);
    }

    const backupPath = path.join(__dirname, 'backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    console.log("\n🎉 EXPORT RÉUSSI !");
    console.log(`Fichier sauvegardé ici : ${backupPath}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur :", error.message);
    process.exit(1);
  }
}

exportData();
