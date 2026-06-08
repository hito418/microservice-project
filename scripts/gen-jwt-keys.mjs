#!/usr/bin/env node
// Generates an ES256 (P-256) keypair for local development and writes the PEMs
// under .secrets/jwt-dev/. Pair with docker-compose's bind mount, which points
// JWT_PRIVATE_KEY_PATH at the private key inside the auth container.
//
// Never use the output of this script in production — generate keys in your
// secrets manager and inject them via env / mounted volumes.

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', '.secrets', 'jwt-dev');
const privPath = resolve(outDir, 'jwt-private.pem');
const pubPath = resolve(outDir, 'jwt-public.pem');

const force = process.argv.includes('--force');
if (!force && existsSync(privPath)) {
    console.log(`Keys already exist at ${outDir}. Pass --force to overwrite.`);
    process.exit(0);
}

mkdirSync(outDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privPath, privateKey, { mode: 0o600 });
writeFileSync(pubPath, publicKey, { mode: 0o644 });

console.log(`Wrote ${privPath}`);
console.log(`Wrote ${pubPath}`);
