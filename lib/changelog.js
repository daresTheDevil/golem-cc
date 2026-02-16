const fs = require('fs');
const path = require('path');

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
 * Detect potential secrets in text
 * @param {string} text - Text to scan
 * @returns {boolean} True if potential secret found
 */
function detectSecrets(text) {
  if (typeof text !== 'string') {
    return false;
  }

  // Pattern: (api_key|password|secret|token|credential) followed by separator and 8+ chars
  // Separator can be colon, equals, or space
  // This catches: "password: abc123", "API_KEY=xyz789", "credential abc123xyz", "password: s3cr3tP@ss"
  // May have false positives (e.g., "token validation") but better safe than exposing secrets
  const secretPattern = /(api[_-]?key|password|secret|token|credential)[\s]*[:=\s][\s]*[A-Za-z0-9+/=_@#$%^&*!-]{8,}/i;

  // However, exclude common technical words that aren't secrets
  const commonWords = /\b(validation|field|form|logic|handling|support|check|verify|update|method|function|component|page|route)\b/i;

  if (secretPattern.test(text)) {
    // Extract the potential secret value
    const match = text.match(secretPattern);
    if (match) {
      const potentialSecret = text.substring(match.index + match[1].length).trim();
      // If it starts with a common word, it's probably not a secret
      if (commonWords.test(potentialSecret.split(/\s+/)[0])) {
        return false;
      }
    }
    return true;
  }

  return false;
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

module.exports = {
  getTemplate,
  detectLineEnding,
  parseChangelog,
  validateEntry,
  detectSecrets,
  sanitizeMarkdown,
  suggestCategory,
};
