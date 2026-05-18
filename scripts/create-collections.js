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

const fs = require('fs');
const pathModule = require('path');

let POCKETBASE_URL = 'http://192.168.1.110:8090';

// Lecture du fichier .env
try {
  const envPath = pathModule.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_POCKETBASE_URL\s*=\s*(.+)/);
    if (match && match[1]) {
      POCKETBASE_URL = match[1].trim();
    }
  }
} catch (e) {
  // Ignorer
}

const [,, adminEmail, adminPassword, customUrl] = process.argv;
if (!adminEmail || !adminPassword) {
  console.error('Usage: node create-collections.js <email> <password> [pocketbase-url]');
  console.error('Exemple : node scripts/create-collections.js admin@example.com mon_passe http://127.0.0.1:8090');
  process.exit(1);
}

if (customUrl) {
  POCKETBASE_URL = customUrl.trim();
}

console.log(`📡 URL PocketBase ciblée : ${POCKETBASE_URL}`);

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
  const authRes = await apiRequest('collections/_superusers/auth-with-password', 'POST', {
    identity: adminEmail,
    password: adminPassword,
  });
  const token = authRes.token;
  console.log('✅ Connecté');

  // 2. Ajout du champ householdId et sécurisation de la collection users (built-in)
  console.log('\n📦 Extension et sécurisation de la collection users...');
  const usersCol = await apiRequest('collections/users', 'GET', null, token);
  const hasHouseholdId = usersCol.schema?.some(f => f.name === 'householdId') || usersCol.fields?.some(f => f.name === 'householdId');
  
  const updatedFields = [...(usersCol.fields || [])];
  if (!hasHouseholdId) {
    updatedFields.push({ name: 'householdId', type: 'text', required: false });
  }

  await apiRequest('collections/users', 'PATCH', {
    schema: hasHouseholdId ? usersCol.schema : [...(usersCol.schema || []), { name: 'householdId', type: 'text', required: false }],
    fields: updatedFields,
    listRule: '@request.auth.id != "" && (id = @request.auth.id || (@request.auth.householdId != "" && householdId = @request.auth.householdId))',
    viewRule: '@request.auth.id != "" && (id = @request.auth.id || (@request.auth.householdId != "" && householdId = @request.auth.householdId))',
    createRule: '', // Autorise la création de compte publique
    updateRule: 'id = @request.auth.id', // Ne peut modifier que lui-même
    deleteRule: 'id = @request.auth.id',
  }, token);
  console.log('  ✅ Collection users mise à jour et sécurisée');

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
        { name: 'householdId',       type: 'text',   required: true },
        { name: 'userId',            type: 'text',   required: false },
        { name: 'description',       type: 'text',   required: false },
        { name: 'amount',            type: 'number', required: false },
        { name: 'date',              type: 'text',   required: false },
        { name: 'category',          type: 'text',   required: false },
        { name: 'visibility',        type: 'text',   required: false },
        { name: 'paidBy',            type: 'text',   required: false },
        { name: 'accountId',         type: 'text',   required: false },
        { name: 'note',              type: 'text',   required: false },
        { name: 'distributionType',  type: 'text',   required: false },
        { name: 'customPercentages', type: 'json',   required: false },
        { name: 'customAmounts',     type: 'json',   required: false },
        { name: 'distribution',      type: 'json',   required: false },
      ],
    },
    {
      name: 'charges',
      schema: [
        { name: 'householdId',       type: 'text',   required: true },
        { name: 'userId',            type: 'text',   required: false },
        { name: 'name',              type: 'text',   required: false },
        { name: 'amount',            type: 'number', required: false },
        { name: 'frequency',         type: 'text',   required: false },
        { name: 'visibility',        type: 'text',   required: false },
        { name: 'category',          type: 'text',   required: false },
        { name: 'distribution',      type: 'json',   required: false },
        { name: 'accountId',         type: 'text',   required: false },
        { name: 'note',              type: 'text',   required: false },
        { name: 'dueDate',           type: 'number', required: false },
        { name: 'distributionType',  type: 'text',   required: false },
        { name: 'customPercentages', type: 'json',   required: false },
        { name: 'customAmounts',     type: 'json',   required: false },
        { name: 'annualAmount',      type: 'number', required: false },
        { name: 'annualDueDate',     type: 'text',   required: false },
        { name: 'validFrom',         type: 'text',   required: false },
        { name: 'validTo',           type: 'text',   required: false },
      ],
    },
    {
      name: 'settlements',
      schema: [
        { name: 'householdId', type: 'text',   required: true },
        { name: 'amount',      type: 'number', required: false },
        { name: 'fromId',      type: 'text',   required: false },
        { name: 'toId',        type: 'text',   required: false },
        { name: 'year',        type: 'number', required: false },
        { name: 'month',       type: 'number', required: false },
        { name: 'type',        type: 'text',   required: false },
        { name: 'date',        type: 'text',   required: false },
        { name: 'note',        type: 'text',   required: false },
      ],
    },
    {
      name: 'savings',
      schema: [
        { name: 'householdId',     type: 'text',   required: true },
        { name: 'userId',          type: 'text',   required: false },
        { name: 'name',            type: 'text',   required: false },
        { name: 'amount',          type: 'number', required: false },
        { name: 'targetAmount',    type: 'number', required: false },
        { name: 'category',        type: 'text',   required: false },
        { name: 'note',            type: 'text',   required: false },
        { name: 'createdAt',       type: 'text',   required: false },
        { name: 'destination',     type: 'text',   required: false },
        { name: 'visibility',      type: 'text',   required: false },
      ],
    },
    {
      name: 'projects',
      schema: [
        { name: 'householdId',   type: 'text',   required: true },
        { name: 'userId',        type: 'text',   required: false },
        { name: 'name',          type: 'text',   required: false },
        { name: 'targetAmount',  type: 'number', required: false },
        { name: 'currentAmount', type: 'number', required: false },
        { name: 'contributions', type: 'json',   required: false },
        { name: 'status',        type: 'text',   required: false },
        { name: 'category',      type: 'text',   required: false },
        { name: 'note',          type: 'text',   required: false },
        { name: 'createdAt',     type: 'text',   required: false },
        { name: 'iconKey',       type: 'text',   required: false },
        { name: 'targetDate',    type: 'text',   required: false },
        { name: 'description',   type: 'text',   required: false },
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

  // 4. Création / Mise à jour des collections
  console.log('\n📦 Création et alignement des collections...');
  for (const col of collections) {
    try {
      // Calcul des règles d'API selon la collection pour une isolation stricte des foyers
      const isHouseholdCol = col.name === 'households';
      const listRule   = isHouseholdCol ? '@request.auth.id != ""' : '@request.auth.id != "" && @request.auth.householdId != "" && householdId = @request.auth.householdId';
      const viewRule   = isHouseholdCol ? '@request.auth.id != ""' : '@request.auth.id != "" && @request.auth.householdId != "" && householdId = @request.auth.householdId';
      const createRule = isHouseholdCol ? '@request.auth.id != ""' : '@request.auth.id != "" && @request.auth.householdId != "" && @request.data.householdId = @request.auth.householdId';
      const updateRule = isHouseholdCol ? '@request.auth.id != ""' : '@request.auth.id != "" && @request.auth.householdId != "" && householdId = @request.auth.householdId && @request.data.householdId = @request.auth.householdId';
      const deleteRule = isHouseholdCol ? '@request.auth.id != ""' : '@request.auth.id != "" && @request.auth.householdId != "" && householdId = @request.auth.householdId';

      // 1. Tenter d'obtenir la collection existante
      let existingCol = null;
      try {
        existingCol = await apiRequest(`collections/${col.name}`, 'GET', null, token);
      } catch (e) {
        // La collection n'existe pas encore
      }

      if (existingCol) {
        // La collection existe déjà, on la met à jour pour s'assurer que ses champs sont présents
        console.log(`  ⚙️  Mise à jour et sécurisation de la collection "${col.name}"...`);
        
        // Sous PocketBase v0.22+, il faut préserver les champs systèmes existants (comme id, created, updated) dans l'array fields
        const existingFields = existingCol.fields || [];
        const newFields = [...existingFields];
        
        // Ajouter les champs personnalisés s'ils n'existent pas déjà
        col.schema.forEach(newField => {
          if (!newFields.some(f => f.name === newField.name)) {
            newFields.push(newField);
          }
        });

        await apiRequest(`collections/${col.name}`, 'PATCH', {
          schema: col.schema,
          fields: newFields,
          listRule,
          viewRule,
          createRule,
          updateRule,
          deleteRule,
        }, token);
        console.log(`  ✅ Collection "${col.name}" alignée et sécurisée avec succès`);
      } else {
        // Créer la collection
        console.log(`  ➕ Création de la collection "${col.name}"...`);
        await apiRequest('collections', 'POST', {
          name: col.name,
          type: 'base',
          schema: col.schema,
          fields: col.schema,
          listRule,
          viewRule,
          createRule,
          updateRule,
          deleteRule,
        }, token);
        console.log(`  ✅ Collection "${col.name}" créée et sécurisée avec succès`);
      }
    } catch (err) {
      console.error(`  ❌ Erreur sur la collection "${col.name}" : ${err.message}`);
    }
  }

  console.log('\n🎉 Collections créées ! Lance maintenant le script d\'import :');
  console.log('   node scripts/import-to-pocketbase.js <email> <password> scripts/backup.json');
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
