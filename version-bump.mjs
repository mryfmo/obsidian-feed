import process from 'process';
import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
  console.error('Error: npm_package_version not set. Run this script via npm/pnpm.');
  process.exit(1);
}

console.log(`Bumping version to ${targetVersion}...`);

// Read and update manifest.json
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const oldManifestVersion = manifest.version;
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));
console.log(`✓ Updated manifest.json: ${oldManifestVersion} → ${targetVersion}`);

// Update versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
console.log(`✓ Added ${targetVersion} to versions.json`);

// Check if CHANGELOG.md has an entry for this version
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const versionPattern = new RegExp(`^## \\[?${targetVersion.replace(/\./g, '\\.')}\\]?`, 'm');
if (!versionPattern.test(changelog)) {
  console.warn(`⚠️  Warning: No entry for version ${targetVersion} found in CHANGELOG.md`);
  console.warn('  Please add a changelog entry before releasing.');

  // Create a template entry
  const date = new Date().toISOString().split('T')[0];
  const template = `
## [${targetVersion}] – ${date}

### Added
- 

### Fixed
- 

### Changed
- 

`;
  console.log('\nSuggested CHANGELOG entry:');
  console.log('─'.repeat(50));
  console.log(template);
  console.log('─'.repeat(50));
}

// Verify all versions match
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.version !== targetVersion) {
  console.error(
    `❌ Error: package.json version (${pkg.version}) doesn't match target (${targetVersion})`
  );
  process.exit(1);
}

console.log('\n✅ Version bump complete!');
console.log(`   All files now at version ${targetVersion}`);
