

// Since we cannot run directly, let's write a node script that will be executed on the VM to inspect the 'users' collection structure.
import pathModule from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);

let POCKETBASE_URL = 'http://127.0.0.1:8090';

const [,, adminEmail, adminPassword] = process.argv;
if (!adminEmail || !adminPassword) {
  console.error('Usage: node check-users.js <email> <password>');
  process.exit(1);
}

async function main() {
  const headers = { 'Content-Type': 'application/json' };
  const authRes = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ identity: adminEmail, password: adminPassword }),
  });
  const authJson = await authRes.json();
  if (!authRes.ok) {
    console.error('Auth failed:', authJson);
    process.exit(1);
  }

  const res = await fetch(`${POCKETBASE_URL}/api/collections/users`, {
    headers: {
      ...headers,
      'Authorization': `Bearer ${authJson.token}`
    }
  });
  const usersCol = await res.json();
  console.log('--- USERS COLLECTION DETAILS ---');
  console.log(JSON.stringify(usersCol, null, 2));
}

main().catch(err => console.error(err));
