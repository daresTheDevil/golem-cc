#!/usr/bin/env node

// Generate checksums.json for integrity verification
// Run during prepublishOnly to ensure checksums are up to date

const fs = require('fs');
const path = require('path');
const { generateManifest } = require('../lib/integrity.js');

const PKG_ROOT = path.resolve(__dirname, '..');
const CHECKSUM_FILE = path.join(PKG_ROOT, 'checksums.json');

console.log('Generating checksums...');

// Generate checksums for all package files
const manifest = generateManifest(PKG_ROOT);

// Write to checksums.json
fs.writeFileSync(CHECKSUM_FILE, JSON.stringify(manifest, null, 2));

const count = Object.keys(manifest).length;
console.log(`Generated checksums for ${count} files → checksums.json`);
