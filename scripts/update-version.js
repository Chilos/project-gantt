/**
 * Update version script
 * Syncs version from package.json to package.json logseq.version
 */

const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Ensure logseq object exists
if (!packageJson.logseq) {
  packageJson.logseq = {};
}

// Update version in logseq object
packageJson.logseq.version = packageJson.version;

// Write back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Updated version to ${packageJson.version}`);
