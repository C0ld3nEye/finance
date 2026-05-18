import pathModule from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);

let POCKETBASE_URL = 'http://127.0.0.1:8090';

const [,, adminEmail, adminPassword] = process.argv;
if (!adminEmail || !adminPassword) {
  console.error('Usage: node restore-username.js <email> <password>');
  process.exit(1);
}

async function apiRequest(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${POCKETBASE_URL}/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} /api/${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  console.log('🔐 Connexion admin...');
  const authRes = await apiRequest('collections/_superusers/auth-with-password', 'POST', {
    identity: adminEmail,
    password: adminPassword,
  });
  const token = authRes.token;
  console.log('✅ Connecté');

  console.log('📦 Récupération de la collection users...');
  const usersCol = await apiRequest('collections/users', 'GET', null, token);

  const hasUsernameField = usersCol.fields?.some(f => f.name === 'username');
  if (hasUsernameField) {
    console.log('✅ Le champ username est déjà présent dans les fields. Pas besoin de restaurer.');
    return;
  }

  console.log('🔧 Restauration du champ systeme username...');
  
  // Reconstruction des fields et du schema en réinsérant proprement username
  const newFields = [...(usersCol.fields || [])];
  
  // On insère username juste après password/id pour correspondre aux specs PocketBase
  newFields.splice(2, 0, {
    autogeneratePattern: "users[0-9]{5,10}",
    hidden: false,
    id: "text2857410077",
    max: 150,
    min: 3,
    name: "username",
    pattern: "^[\\w][\\w\\.\\-]*$",
    presentable: false,
    primaryKey: false,
    required: true,
    system: true,
    type: "text"
  });

  const newSchema = [...(usersCol.schema || [])];
  const hasUsernameSchema = newSchema.some(f => f.name === 'username');
  if (!hasUsernameSchema) {
    newSchema.push({
      name: 'username',
      type: 'text',
      required: true,
      system: true,
      min: 3,
      max: 150,
      pattern: "^[\\w][\\w\\.\\-]*$",
    });
  }

  // ÉTAPE 1 : Ajouter le champ username SANS l'index unique
  await apiRequest('collections/users', 'PATCH', {
    schema: newSchema,
    fields: newFields,
    // On garde les index existants pour l'instant (sans l'index username)
    indexes: usersCol.indexes || [],
  }, token);

  console.log('✅ Champ username recréé (sans contrainte unique).');

  // ÉTAPE 2 : Récupérer tous les utilisateurs et leur donner un username unique temporaire
  console.log("🔄 Mise à jour des utilisateurs existants pour garantir l'unicité...");
  const recordsRes = await apiRequest('collections/users/records?perPage=500', 'GET', null, token);
  for (const record of recordsRes.items) {
    if (!record.username || record.username.trim() === '') {
      const tempUsername = `user_${Math.random().toString(36).substring(2, 10)}`;
      await apiRequest(`collections/users/records/${record.id}`, 'PATCH', {
        username: tempUsername
      }, token);
      console.log(`  - Utilisateur ${record.id} mis à jour avec le pseudo : ${tempUsername}`);
    }
  }

  // ÉTAPE 3 : Ajouter l'index UNIQUE maintenant que tous les utilisateurs ont un pseudo différent
  console.log('🔒 Ajout de la contrainte UNIQUE sur username...');
  const newIndexes = [...(usersCol.indexes || [])];
  const hasUsernameIndex = newIndexes.some(idx => idx.includes('username'));
  if (!hasUsernameIndex) {
    newIndexes.push("CREATE UNIQUE INDEX `idx_username__pb_users_auth_` ON `users` (`username`)");
  }

  await apiRequest('collections/users', 'PATCH', {
    schema: newSchema,
    fields: newFields,
    indexes: newIndexes,
  }, token);

  console.log('🎉 Restauration complète et réussie !');
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
