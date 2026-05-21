#!/usr/bin/env node
/**
 * Script d'import des données Firebase → PocketBase
 *
 * Prérequis :
 *   1. PocketBase est démarré sur http://192.168.1.110:8090
 *   2. Les collections ont été créées (create-collections.js)
 *   3. Les 2 comptes utilisateurs ont été créés dans l'interface admin PocketBase
 *   4. backup.json a été téléchargé depuis l'app (bouton "Export données Firebase")
 *
 * Usage :
 *   node scripts/import-to-pocketbase.js <admin-email> <admin-password> <chemin/backup.json>
 *
 * Exemple :
 *   node scripts/import-to-pocketbase.js admin@foyer.local motdepasse ./backup.json
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let POCKETBASE_URL = 'http://127.0.0.1:8090';

// Lecture du fichier .env
try {
  const envPath = join(__dirname, '../.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_POCKETBASE_URL\s*=\s*(.+)/);
    if (match && match[1]) {
      const url = match[1].trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        POCKETBASE_URL = url;
      }
    }
  }
} catch (_) {}
const [,, adminEmail, adminPassword, backupPath] = process.argv;

if (!adminEmail || !adminPassword || !backupPath) {
  console.error('Usage: node import-to-pocketbase.js <email> <password> <backup.json>');
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

async function importCollection(token, colName, records) {
  if (!records || records.length === 0) {
    console.log(`  ⏭️  ${colName} (vide)`);
    return;
  }
  let ok = 0, fail = 0;
  for (const record of records) {
    const { _firebaseId, ...data } = record;
    try {
      await apiRequest(`collections/${colName}/records`, 'POST', data, token);
      ok++;
    } catch (err) {
      console.warn(`    ⚠️  ${colName}/${_firebaseId} : ${err.message}`);
      fail++;
    }
  }
  console.log(`  ✅ ${colName} : ${ok} importés${fail > 0 ? `, ${fail} erreurs` : ''}`);
}

async function main() {
  // 1. Lecture du backup
  console.log(`📂 Lecture du backup : ${backupPath}`);
  const backup = JSON.parse(readFileSync(backupPath, 'utf-8'));
  console.log(`   Foyer : ${backup.householdId}`);
  console.log(`   Exporté le : ${backup.exportedAt}`);

  // 2. Auth admin PocketBase
  console.log('\n🔐 Connexion admin PocketBase...');
  const authRes = await apiRequest('collections/_superusers/auth-with-password', 'POST', {
    identity: adminEmail,
    password: adminPassword,
  });
  const token = authRes.token;
  console.log('✅ Connecté');

  // 3. Créer le foyer
  console.log('\n🏠 Création du foyer...');
  try {
    await apiRequest('collections/households/records', 'POST', {
      name: backup.householdId,
    }, token);
    console.log(`  ✅ Foyer "${backup.householdId}" créé`);
  } catch {
    console.log(`  ⏭️  Foyer déjà existant`);
  }

  // 4. Import settings
  console.log('\n⚙️  Import des paramètres...');
  if (backup.data?.settings) {
    try {
      // Vérifier si settings existe déjà
      const existing = await apiRequest(
        `collections/settings/records?filter=${encodeURIComponent(`householdId = "${backup.householdId}"`)}`,
        'GET', null, token
      );
      if (existing.items?.length > 0) {
        await apiRequest(`collections/settings/records/${existing.items[0].id}`, 'PATCH', {
          ...backup.data.settings, householdId: backup.householdId
        }, token);
        console.log('  ✅ Paramètres mis à jour');
      } else {
        await apiRequest('collections/settings/records', 'POST', {
          ...backup.data.settings, householdId: backup.householdId
        }, token);
        console.log('  ✅ Paramètres créés');
      }
    } catch (err) {
      console.error('  ❌ Erreur settings :', err.message);
    }
  }

  // 5. Import des collections
  console.log('\n📦 Import des données...');
  const collections = ['expenses', 'charges', 'settlements', 'savings', 'projects', 'salaries'];
  for (const col of collections) {
    await importCollection(token, col, backup.data[col]);
  }

  console.log('\n🎉 Import terminé !');
  console.log('   Prochaine étape : connecte-toi à l\'app avec tes nouveaux identifiants PocketBase.');
  console.log(`   Interface admin : ${POCKETBASE_URL}/_/`);
}

main().catch(err => {
  console.error('❌ Erreur fatale :', err.message);
  process.exit(1);
});
