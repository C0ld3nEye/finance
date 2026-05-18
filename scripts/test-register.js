import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
  const randomEmail = `test-${Math.random().toString(36).substring(2, 8)}@outlook.com`;
  console.log(`🔄 Tentative d'inscription de test avec l'email : ${randomEmail}...`);
  try {
    const record = await pb.collection('users').create({
      email: randomEmail,
      password: 'SuperSecretPassword123!',
      passwordConfirm: 'SuperSecretPassword123!',
    });
    console.log('✅ Inscription réussie !');
    console.log('Nouvel utilisateur créé :', JSON.stringify(record, null, 2));
  } catch (err) {
    console.error('❌ Erreur d\\'inscription détectée :');
    console.error('Message :', err.message);
    console.error('Code Statut HTTP :', err.status);
    console.error('Réponse brute du serveur :', JSON.stringify(err.response, null, 2));
    if (err.originalError) {
      console.error("Erreur d'origine :", err.originalError);
    }
  }
}

main();
