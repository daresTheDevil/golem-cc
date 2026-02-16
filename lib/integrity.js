// File integrity verification using SHA-256 checksums

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Verify that a file matches its expected checksum
 * @param {string} filepath - Absolute path to file
 * @param {string} expectedHash - Expected SHA-256 hash (64-char hex)
 * @returns {boolean} True if file matches checksum, false otherwise
 */
function verifyChecksum(filepath, expectedHash) {
  try {
    if (!fs.existsSync(filepath)) {
      return false;
    }

    const content = fs.readFileSync(filepath);
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');

    return actualHash === expectedHash;
  } catch {
    return false;
  }
}

/**
 * Generate checksums for all files in a directory (recursive)
 * @param {string} dirPath - Directory to scan
 * @param {string} basePath - Base path for relative file paths (defaults to dirPath)
 * @returns {Object} Map of relative file paths to SHA-256 hashes
 */
function generateManifest(dirPath, basePath = null) {
  if (!basePath) basePath = dirPath;

  const manifest = {};

  try {
    if (!fs.existsSync(dirPath)) {
      return manifest;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip node_modules, .git, and other build artifacts
      if (['node_modules', '.git', '.golem', '.claude', 'dist', 'build'].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        const subManifest = generateManifest(fullPath, basePath);
        Object.assign(manifest, subManifest);
      } else if (entry.isFile()) {
        // Generate checksum for file
        try {
          const content = fs.readFileSync(fullPath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          const relativePath = path.relative(basePath, fullPath);
          manifest[relativePath] = hash;
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Return empty manifest on error
  }

  return manifest;
}

module.exports = {
  verifyChecksum,
  generateManifest,
};
