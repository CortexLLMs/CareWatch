import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'health.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✓ Old health.db deleted — fresh start!');
} else {
  console.log('ℹ No health.db found — nothing to delete.');
}
console.log('→ Now run: node server.js');
