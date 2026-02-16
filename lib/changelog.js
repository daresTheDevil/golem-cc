const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Keep a Changelog standard categories in order
const CATEGORIES = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];

/**
 * Returns Keep a Changelog v1.1.0 template
 * @returns {string} CHANGELOG.md template
 */
function getTemplate() {
  return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

`;
}

/**
 * Detect line ending style in text
 * @param {string} text - Text to analyze
 * @returns {string} '\n' or '\r\n'
 */
function detectLineEnding(text) {
  if (typeof text !== 'string') {
    return '\n';
  }

  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.match(/\n/g) || []).length - crlfCount;

  // If majority is CRLF, use CRLF; otherwise default to LF
  return crlfCount > lfCount ? '\r\n' : '\n';
}

/**
 * Parse CHANGELOG.md into AST structure
 * @param {string} text - CHANGELOG.md content
 * @returns {object} AST with {header, unreleased, releases, links}
 */
function parseChangelog(text) {
  if (typeof text !== 'string') {
    throw new TypeError('parseChangelog requires text parameter to be a string');
  }

  const lines = text.split(/\r?\n/);
  const lineEnding = detectLineEnding(text);
  const ast = {
    header: '',
    unreleased: {
      added: [],
      changed: [],
      deprecated: [],
      removed: [],
      fixed: [],
      security: [],
    },
    releases: [],
    links: [],
    lineEnding, // Store for later rendering
  };

  let section = 'header'; // header, unreleased, release, links
  let currentCategory = null;
  let currentRelease = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Main heading
    if (line.startsWith('# ')) {
      ast.header += line + '\n';
      continue;
    }

    // [Unreleased] section
    if (line.match(/^## \[Unreleased\]/)) {
      section = 'unreleased';
      currentCategory = null;
      continue;
    }

    // Release version section (e.g., ## [1.0.0] - 2026-01-15)
    const releaseMatch = line.match(/^## \[(.+?)\] - (.+)/);
    if (releaseMatch) {
      if (currentRelease) {
        ast.releases.push(currentRelease);
      }
      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2],
        sections: {
          added: [],
          changed: [],
          deprecated: [],
          removed: [],
          fixed: [],
          security: [],
        },
      };
      section = 'release';
      currentCategory = null;
      continue;
    }

    // Category headings
    const categoryMatch = line.match(/^### (Added|Changed|Deprecated|Removed|Fixed|Security)/);
    if (categoryMatch) {
      const category = categoryMatch[1].toLowerCase();
      currentCategory = category;
      continue;
    }

    // Links section (bottom of file)
    if (line.match(/^\[.+?\]:/)) {
      section = 'links';
      ast.links.push(line);
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') && currentCategory) {
      const content = line.substring(2); // Remove "- " prefix
      if (section === 'unreleased') {
        ast.unreleased[currentCategory].push(content);
      } else if (section === 'release' && currentRelease) {
        currentRelease.sections[currentCategory].push(content);
      }
      continue;
    }

    // Header content (before [Unreleased])
    if (section === 'header' && line.trim()) {
      ast.header += line + '\n';
    }
  }

  // Push last release if exists
  if (currentRelease) {
    ast.releases.push(currentRelease);
  }

  return ast;
}

/**
 * Validate changelog entry
 * @param {string} message - Entry text
 * @returns {object} {valid: bool, error?: string, sanitized?: string}
 */
function validateEntry(message) {
  if (typeof message !== 'string' || message.trim() === '') {
    return {
      valid: false,
      error: 'Changelog entry cannot be empty',
    };
  }

  // Check for secrets
  if (detectSecrets(message)) {
    return {
      valid: false,
      error: 'Potential secret detected in changelog entry',
    };
  }

  // Sanitize markdown conflicts
  const sanitized = sanitizeMarkdown(message);
  if (sanitized !== message) {
    return {
      valid: true,
      sanitized,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Check if text starts with a common technical word (not a secret)
 * @param {string} text - Text to check
 * @returns {boolean} True if starts with common word
 */
function isCommonWord(text) {
  const commonWords = /\b(validation|field|form|logic|handling|support|check|verify|update|method|function|component|page|route)\b/i;
  return commonWords.test(text.split(/\s+/)[0]);
}

/**
 * Detect potential secrets in text
 * @param {string} text - Text to scan
 * @returns {boolean} True if potential secret found
 */
function detectSecrets(text) {
  if (typeof text !== 'string') {
    return false;
  }

  // Pattern: (api_key|password|secret|token|credential) followed by separator and 8+ chars
  const secretPattern = /(api[_-]?key|password|secret|token|credential)[\s]*[:=\s][\s]*[A-Za-z0-9+/=_@#$%^&*!-]{8,}/i;
  const match = text.match(secretPattern);

  if (!match) {
    return false;
  }

  // Extract potential secret value and check if it's a common word
  const afterKeyword = text.substring(match.index + match[1].length).trim();
  return !isCommonWord(afterKeyword);
}

/**
 * Sanitize markdown to prevent structure conflicts
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeMarkdown(text) {
  if (typeof text !== 'string') {
    return '';
  }

  // Escape ## patterns that could conflict with headings
  return text.replace(/##/g, '\\##');
}

/**
 * Suggest correct category for common typos
 * @param {string} input - Category input
 * @returns {string|null} Suggested category or null
 */
function suggestCategory(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.toLowerCase().trim();

  // Map common typos to correct categories
  const suggestions = {
    add: 'added',
    adds: 'added',
    change: 'changed',
    changes: 'changed',
    deprecate: 'deprecated',
    deprecates: 'deprecated',
    remove: 'removed',
    removes: 'removed',
    fix: 'fixed',
    fixes: 'fixed',
  };

  return suggestions[normalized] || (CATEGORIES.includes(normalized) ? normalized : null);
}

/**
 * Add entry to changelog AST
 * @param {object} ast - Parsed changelog AST
 * @param {string} category - Category (added, changed, etc.)
 * @param {string} message - Entry message
 * @returns {object} Updated AST
 */
function addEntry(ast, category, message) {
  if (!ast || !ast.unreleased) {
    throw new TypeError('Invalid AST structure');
  }

  if (!CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}`);
  }

  if (typeof message !== 'string' || message.trim() === '') {
    throw new Error('Entry message cannot be empty');
  }

  // Clone AST to avoid mutation
  const updated = JSON.parse(JSON.stringify(ast));

  // Initialize category if missing
  if (!updated.unreleased[category]) {
    updated.unreleased[category] = [];
  }

  // Deduplicate: only add if not already present
  if (!updated.unreleased[category].includes(message)) {
    // Prepend (newest first)
    updated.unreleased[category].unshift(message);
  }

  return updated;
}

/**
 * Render changelog AST back to markdown
 * @param {object} ast - Parsed changelog AST
 * @returns {string} Markdown text
 */
function renderChangelog(ast) {
  if (!ast) {
    throw new TypeError('Invalid AST structure');
  }

  // Use stored line ending or default to LF
  const lineEnding = ast.lineEnding || '\n';
  const lines = [];

  // Header
  if (ast.header) {
    lines.push(ast.header.trim());
    lines.push('');
  }

  // [Unreleased] section
  lines.push('## [Unreleased]');
  lines.push('');

  // Add categories in order, only if they have entries
  for (const category of CATEGORIES) {
    if (ast.unreleased[category] && ast.unreleased[category].length > 0) {
      const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`### ${categoryTitle}`);
      for (const entry of ast.unreleased[category]) {
        lines.push(`- ${entry}`);
      }
      lines.push('');
    }
  }

  // Releases
  for (const release of ast.releases || []) {
    lines.push(`## [${release.version}] - ${release.date}`);
    lines.push('');

    for (const category of CATEGORIES) {
      if (release.sections[category] && release.sections[category].length > 0) {
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        lines.push(`### ${categoryTitle}`);
        for (const entry of release.sections[category]) {
          lines.push(`- ${entry}`);
        }
        lines.push('');
      }
    }
  }

  // Links
  if (ast.links && ast.links.length > 0) {
    for (const link of ast.links) {
      lines.push(link);
    }
    lines.push('');
  }

  return lines.join(lineEnding);
}

/**
 * Check if version already exists in releases
 * @param {object} ast - Parsed changelog AST
 * @param {string} version - Version to check
 * @returns {boolean} True if version exists
 */
function versionExists(ast, version) {
  if (!ast || !ast.releases) {
    return false;
  }

  return ast.releases.some(r => r.version === version);
}

/**
 * Release a new version (move [Unreleased] to versioned section)
 * @param {object} ast - Parsed changelog AST
 * @param {string} version - Version number (e.g., "1.2.3")
 * @param {string} date - Release date (YYYY-MM-DD)
 * @returns {object|null} Updated AST or null if nothing to release
 */
function releaseVersion(ast, version, date) {
  if (!ast || !ast.unreleased) {
    throw new TypeError('Invalid AST structure');
  }

  if (versionExists(ast, version)) {
    throw new Error(`Version ${version} already exists in CHANGELOG.md`);
  }

  // Check if there's anything to release
  const hasEntries = CATEGORIES.some(cat => ast.unreleased[cat] && ast.unreleased[cat].length > 0);
  if (!hasEntries) {
    return null; // Nothing to release
  }

  // Clone AST
  const updated = JSON.parse(JSON.stringify(ast));

  // Create new release from unreleased
  const newRelease = {
    version,
    date,
    sections: { ...updated.unreleased },
  };

  // Prepend to releases (newest first)
  updated.releases.unshift(newRelease);

  // Clear unreleased
  for (const category of CATEGORIES) {
    updated.unreleased[category] = [];
  }

  return updated;
}

/**
 * Get git remote URL
 * @returns {object|null} {url, host} or null if no remote
 */
function getGitRemote() {
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

    // Extract host from URL (handle both HTTPS and SSH)
    let host;
    if (url.startsWith('http')) {
      host = new URL(url).hostname;
    } else if (url.includes('@')) {
      // SSH format: git@github.com:user/repo.git
      host = url.split('@')[1].split(':')[0];
    } else {
      return null;
    }

    return { url, host };
  } catch (err) {
    return null; // Not in a git repo or no remote
  }
}

/**
 * Generate comparison links for GitHub/GitLab
 * @param {object} ast - Parsed changelog AST
 * @param {object|null} remote - {url, host} from getGitRemote()
 * @returns {array} Array of link strings
 */
function generateComparisonLinks(ast, remote) {
  if (!remote || !ast.releases || ast.releases.length === 0) {
    return [];
  }

  const links = [];

  // Convert SSH to HTTPS for links
  let baseUrl = remote.url;
  if (baseUrl.startsWith('git@')) {
    // git@github.com:user/repo.git → https://github.com/user/repo
    baseUrl = baseUrl.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
  } else {
    baseUrl = baseUrl.replace(/\.git$/, '');
  }

  // [Unreleased] link (compare latest release to HEAD)
  const latestVersion = ast.releases[0].version;
  links.push(`[Unreleased]: ${baseUrl}/compare/v${latestVersion}...HEAD`);

  // Individual release links
  for (let i = 0; i < ast.releases.length; i++) {
    const release = ast.releases[i];
    if (i < ast.releases.length - 1) {
      // Compare to previous release
      const prevRelease = ast.releases[i + 1];
      links.push(`[${release.version}]: ${baseUrl}/compare/v${prevRelease.version}...v${release.version}`);
    } else {
      // First release (link to tag)
      links.push(`[${release.version}]: ${baseUrl}/releases/tag/v${release.version}`);
    }
  }

  return links;
}

/**
 * Load changelog from current directory
 * @param {string} cwd - Working directory
 * @returns {object} {path, ast}
 */
function loadChangelog(cwd) {
  const changelogPath = path.join(cwd || process.cwd(), 'CHANGELOG.md');

  if (fs.existsSync(changelogPath)) {
    const content = fs.readFileSync(changelogPath, 'utf-8');
    const ast = parseChangelog(content);
    return { path: changelogPath, ast };
  }

  // Create from template
  const template = getTemplate();
  const ast = parseChangelog(template);
  return { path: changelogPath, ast };
}

/**
 * Save changelog to file
 * @param {string} filePath - Path to CHANGELOG.md
 * @param {object} ast - Changelog AST
 * @param {boolean} dryRun - If true, don't write
 * @returns {boolean} Success
 */
function saveChangelog(filePath, ast, dryRun) {
  if (dryRun) {
    return true; // Don't write in dry-run mode
  }

  try {
    const content = renderChangelog(ast);
    fs.writeFileSync(filePath, content, { mode: 0o644 });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * CLI entry point
 * @param {array} args - Command line arguments
 * @returns {object} {success: bool, message: string}
 */
function run(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return {
      success: false,
      message: 'Usage: golem changelog <category> <message>\nCategories: added, changed, deprecated, removed, fixed, security',
    };
  }

  // Parse flags
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(a => !a.startsWith('--'));

  if (filteredArgs.length < 2) {
    return {
      success: false,
      message: 'Usage: golem changelog <category> <message>',
    };
  }

  const category = filteredArgs[0].toLowerCase();
  const message = filteredArgs.slice(1).join(' ');

  // Validate category
  if (!CATEGORIES.includes(category)) {
    const suggestion = suggestCategory(category);
    if (suggestion) {
      return {
        success: false,
        message: `Invalid category "${category}". Did you mean "${suggestion}"?`,
      };
    }
    return {
      success: false,
      message: `Invalid category "${category}". Valid categories: ${CATEGORIES.join(', ')}`,
    };
  }

  // Validate entry
  const validation = validateEntry(message);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error,
    };
  }

  // Use sanitized version if provided
  const finalMessage = validation.sanitized || message;

  // Load changelog
  const { path: changelogPath, ast } = loadChangelog();

  // Add entry
  const updated = addEntry(ast, category, finalMessage);

  // Save (or skip if dry-run)
  if (dryRun) {
    return {
      success: true,
      message: `Would add to ${category}: "${finalMessage}"`,
    };
  }

  const saved = saveChangelog(changelogPath, updated, false);
  if (!saved) {
    return {
      success: false,
      message: `Failed to write ${changelogPath}`,
    };
  }

  return {
    success: true,
    message: `Added to ${category}: "${finalMessage}"`,
  };
}

module.exports = {
  getTemplate,
  detectLineEnding,
  parseChangelog,
  validateEntry,
  detectSecrets,
  sanitizeMarkdown,
  suggestCategory,
  addEntry,
  renderChangelog,
  releaseVersion,
  getGitRemote,
  generateComparisonLinks,
  versionExists,
  loadChangelog,
  saveChangelog,
  run,
};
