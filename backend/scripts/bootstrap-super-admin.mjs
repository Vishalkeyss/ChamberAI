#!/usr/bin/env node
/**
 * Creates the first platform super admin in a remote D1 (BUG-067). Login is by email OTP.
 *
 *   npm run bootstrap:super-admin -- --env staging --email you@example.com --name "Your Name"
 *
 * Nothing is hardcoded: email / name / environment come from the arguments.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith('--') ? [...acc, [cur.slice(2), all[i + 1]]] : acc), [])
);
const env = args.env;
const email = (args.email || '').trim().toLowerCase();
const name = (args.name || '').trim();

if (!['staging', 'production'].includes(env) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) {
  console.error('Usage: npm run bootstrap:super-admin -- --env <staging|production> --email <email> --name "<name>"');
  process.exit(1);
}

const sqlString = (v) => `'${String(v).replace(/'/g, "''")}'`;
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const id = `SADM_PLATFORM_${date}_${randomBytes(3).toString('hex').toUpperCase()}`;
const sql =
  `INSERT INTO platform_super_admins (id, name, email, is_active) ` +
  `SELECT ${sqlString(id)}, ${sqlString(name)}, ${sqlString(email)}, 1 ` +
  `WHERE NOT EXISTS (SELECT 1 FROM platform_super_admins WHERE email = ${sqlString(email)});`;

// SQL goes through a temp file: shell quoting of --command differs between Windows and POSIX.
const dir = mkdtempSync(join(tmpdir(), 'chamber-bootstrap-'));
const file = join(dir, 'super-admin.sql');
writeFileSync(file, sql);
console.log(`Creating super admin ${email} in ${env} …`);
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--remote', '--env', env, '--file', file, '--yes'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('Done. Log in on the Super Admin portal with this email (OTP is sent by SendGrid).');
