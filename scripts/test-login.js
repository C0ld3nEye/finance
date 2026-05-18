import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
  console.log('🔄 Tentative de connexion de test...');
  try {
    const authData = await pb.collection('users').authWithPassword('loric.bataille@outlook.com', '3Fran6Sou');
    console.log('✅ Connexion réussie !');
    console.log('Données utilisateur :', JSON.stringify(authData.record, null, 2));
  } catch (err) {
    console.error('❌ Erreur de connexion détectée :');
    console.error('Message :', err.message);
    console.error('Code Statut HTTP :', err.status);
    console.error('Réponse brute du serveur :', JSON.stringify(err.response, null, 2));
    if (err.originalError) {
      console.error("Erreur d'origine :", err.originalError);
    }
  }
}

main();
