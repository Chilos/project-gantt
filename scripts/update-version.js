#!/usr/bin/env node

/**
 * Update version in package.json and manifest.json from git tag
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function getVersionFromTag() {
    try {
        // Get latest git tag
        const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();

        // Remove 'v' prefix if present
        const version = tag.startsWith('v') ? tag.substring(1) : tag;

        console.log(`📌 Found git tag: ${tag}`);
        console.log(`📦 Version: ${version}`);

        return version;
    } catch (error) {
        console.warn('⚠️  No git tags found, using default version 0.0.0');
        return '0.0.0';
    }
}

function updateJsonFile(filePath, version) {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${filePath}`);
        return false;
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const json = JSON.parse(content);

        const oldVersion = json.version;
        json.version = version;

        fs.writeFileSync(fullPath, JSON.stringify(json, null, 2) + '\n', 'utf8');

        console.log(`✅ Updated ${filePath}: ${oldVersion} → ${version}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to update ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log('🔄 Updating version from git tag...\n');

    const version = getVersionFromTag();

    const packageUpdated = updateJsonFile('package.json', version);
    const manifestUpdated = updateJsonFile('manifest.json', version);

    console.log('\n' + '='.repeat(50));

    if (packageUpdated && manifestUpdated) {
        console.log('✨ Version update completed successfully!');
        process.exit(0);
    } else {
        console.log('⚠️  Version update completed with errors');
        process.exit(1);
    }
}

main();
