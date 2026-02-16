const fs = require('fs');
const path = require('path');

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

module.exports = {
  getTemplate,
  detectLineEnding,
  parseChangelog,
};
