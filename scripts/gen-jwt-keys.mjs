#!/usr/bin/env node
// Generates an ES256 (P-256) keypair for local development and writes the PEMs
// under .secrets/jwt/. docker-compose bind-mounts these into the containers:
// the private key into auth (signs), the public key into the gateway (verifies).
//
// Never use the output of this script in production — generate keys in your
// secrets manager and inject them via env / mounted volumes.

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', '.secrets', 'jwt');
const privPath = resolve(outDir, 'private.pem');
const pubPath = resolve(outDir, 'public.pem');

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
