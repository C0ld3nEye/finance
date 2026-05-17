#!/usr/bin/env node
/**
 * Script de création des collections PocketBase
 * À exécuter APRÈS avoir lancé PocketBase et créé le compte admin.
 *
 * Usage :
 *   node scripts/create-collections.js <admin-email> <admin-password>
 *
 * Exemple :
 *   node scripts/create-collections.js admin@foyer.local monmotdepasse
 */

const POCKETBASE_URL = 'http://192.168.1.110:8090';

const [,, adminEmail, adminPassword] = process.argv;
if (!adminEmail || !adminPassword) {
  console.error('Usage: node create-collections.js <email> <password>');
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
  // 1. Authentification admin
  console.log('🔐 Connexion admin...');
  const authRes = await apiRequest('admins/auth-with-password', 'POST', {
    identity: adminEmail,
    password: adminPassword,
  });
  const token = authRes.token;
  console.log('✅ Connecté');

  // 2. Ajout du champ householdId sur la collection users (built-in)
  console.log('\n📦 Extension de la collection users...');
  const usersCol = await apiRequest('collections/users', 'GET', null, token);
  const hasHouseholdId = usersCol.schema?.some(f => f.name === 'householdId');
  if (!hasHouseholdId) {
    await apiRequest('collections/users', 'PATCH', {
      schema: [
        ...(usersCol.schema || []),
        { name: 'householdId', type: 'text', required: false },
      ],
    }, token);
    console.log('  ✅ Champ householdId ajouté aux utilisateurs');
  } else {
    console.log('  ⏭️  householdId déjà présent');
  }

  // 3. Définition des collections à créer
  const collections = [
    {
      name: 'households',
      schema: [
        { name: 'name', type: 'text', required: true },
      ],
    },
    {
      name: 'settings',
      schema: [
        { name: 'householdId', type: 'text', required: true },
        { name: 'members',        type: 'json', required: false },
        { name: 'accounts',       type: 'json', required: false },
        { name: 'accountStartDay', type: 'number', required: false },
      ],
    },
    {
      name: 'expenses',
      schema: [
        { name: 'householdId',  type: 'text',   required: true },
        { name: 'userId',       type: 'text',   required: false },
        { name: 'label',        type: 'text',   required: false },
        { name: 'amount',       type: 'number', required: false },
        { name: 'date',         type: 'text',   required: false },
        { name: 'category',     type: 'text',   required: false },
        { name: 'visibility',   type: 'text',   required: false },
        { name: 'paidBy',       type: 'text',   required: false },
        { name: 'accountId',    type: 'text',   required: false },
        { name: 'note',         type: 'text',   required: false },
      ],
    },
    {
      name: 'charges',
      schema: [
        { name: 'householdId',  type: 'text',   required: true },
        { name: 'userId',       type: 'text',   required: false },
        { name: 'label',        type: 'text',   required: false },
        { name: 'amount',       type: 'number', required: false },
        { name: 'frequency',    type: 'text',   required: false },
        { name: 'visibility',   type: 'text',   required: false },
        { name: 'category',     type: 'text',   required: false },
        { name: 'distribution', type: 'json',   required: false },
        { name: 'accountId',    type: 'text',   required: false },
        { name: 'note',         type: 'text',   required: false },
      ],
    },
    {
      name: 'settlements',
      schema: [
        { name: 'householdId', type: 'text',   required: true },
        { name: 'amount',      type: 'number', required: false },
        { name: 'from',        type: 'text',   required: false },
        { name: 'to',          type: 'text',   required: false },
        { name: 'date',        type: 'text',   required: false },
        { name: 'note',        type: 'text',   required: false },
      ],
    },
    {
      name: 'savings',
      schema: [
        { name: 'householdId',  type: 'text',   required: true },
        { name: 'userId',       type: 'text',   required: false },
        { name: 'label',        type: 'text',   required: false },
        { name: 'amount',       type: 'number', required: false },
        { name: 'targetAmount', type: 'number', required: false },
        { name: 'category',     type: 'text',   required: false },
        { name: 'note',         type: 'text',   required: false },
        { name: 'createdAt',    type: 'text',   required: false },
      ],
    },
    {
      name: 'projects',
      schema: [
        { name: 'householdId',   type: 'text',   required: true },
        { name: 'userId',        type: 'text',   required: false },
        { name: 'label',         type: 'text',   required: false },
        { name: 'targetAmount',  type: 'number', required: false },
        { name: 'currentAmount', type: 'number', required: false },
        { name: 'contributions', type: 'json',   required: false },
        { name: 'status',        type: 'text',   required: false },
        { name: 'category',      type: 'text',   required: false },
        { name: 'note',          type: 'text',   required: false },
        { name: 'createdAt',     type: 'text',   required: false },
      ],
    },
    {
      name: 'salaries',
      schema: [
        { name: 'householdId', type: 'text',   required: true },
        { name: 'salaryId',    type: 'text',   required: true },
        { name: 'year',        type: 'number', required: false },
        { name: 'month',       type: 'number', required: false },
        { name: 'salaries',    type: 'json',   required: false },
        { name: 'updatedAt',   type: 'text',   required: false },
      ],
    },
  ];

  // 4. Création des collections
  console.log('\n📦 Création des collections...');
  for (const col of collections) {
    try {
      await apiRequest('collections', 'POST', {
        name: col.name,
        type: 'base',
        schema: col.schema,
      }, token);
      console.log(`  ✅ ${col.name}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('400')) {
        console.log(`  ⏭️  ${col.name} (déjà existante)`);
      } else {
        console.error(`  ❌ ${col.name} : ${err.message}`);
      }
    }
  }

  console.log('\n🎉 Collections créées ! Lance maintenant le script d\'import :');
  console.log('   node scripts/import-to-pocketbase.js <email> <password> scripts/backup.json');
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
