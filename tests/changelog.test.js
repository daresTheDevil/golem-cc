const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Test will load from lib/changelog.js after it's created
let changelog;

describe('changelog', () => {
  before(() => {
    changelog = require('../lib/changelog.js');
  });

  describe('getTemplate', () => {
    it('returns valid Keep a Changelog v1.1.0 format', () => {
      const template = changelog.getTemplate();

      // Must have header
      assert.ok(template.includes('# Changelog'), 'Missing main heading');
      assert.ok(template.includes('Keep a Changelog'), 'Missing Keep a Changelog reference');
      assert.ok(template.includes('keepachangelog.com'), 'Missing keepachangelog.com link');
      assert.ok(template.includes('Semantic Versioning'), 'Missing semver reference');

      // Must have [Unreleased] section
      assert.ok(template.includes('## [Unreleased]'), 'Missing [Unreleased] section');

      // Must have all six categories in correct order
      const categories = ['### Added', '### Changed', '### Deprecated', '### Removed', '### Fixed', '### Security'];
      let lastIndex = -1;
      for (const category of categories) {
        const index = template.indexOf(category);
        assert.ok(index > lastIndex, `Category ${category} not in correct order`);
        lastIndex = index;
      }
    });

    it('template ends with newline', () => {
      const template = changelog.getTemplate();
      assert.ok(template.endsWith('\n'), 'Template should end with newline');
    });
  });

  describe('detectLineEnding', () => {
    it('detects LF line endings', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const ending = changelog.detectLineEnding(text);
      assert.strictEqual(ending, '\n', 'Should detect LF');
    });

    it('detects CRLF line endings', () => {
      const text = 'Line 1\r\nLine 2\r\nLine 3';
      const ending = changelog.detectLineEnding(text);
      assert.strictEqual(ending, '\r\n', 'Should detect CRLF');
    });

    it('defaults to LF for single-line text', () => {
      const text = 'Single line';
      const ending = changelog.detectLineEnding(text);
      assert.strictEqual(ending, '\n', 'Should default to LF');
    });

    it('prefers CRLF if mixed line endings with majority CRLF', () => {
      const text = 'Line 1\r\nLine 2\r\nLine 3\nLine 4';
      const ending = changelog.detectLineEnding(text);
      assert.strictEqual(ending, '\r\n', 'Should prefer CRLF when majority');
    });
  });

  describe('parseChangelog', () => {
    it('parses valid CHANGELOG.md with all sections', () => {
      const input = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature A
- New feature B

### Fixed
- Bug fix C

## [1.0.0] - 2026-01-15

### Added
- Initial release

[Unreleased]: https://github.com/user/repo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
`;

      const ast = changelog.parseChangelog(input);

      // Check structure
      assert.ok(ast.header, 'Should have header');
      assert.ok(ast.unreleased, 'Should have unreleased section');
      assert.ok(Array.isArray(ast.releases), 'Should have releases array');
      assert.ok(Array.isArray(ast.links), 'Should have links array');

      // Check unreleased entries
      assert.strictEqual(ast.unreleased.added.length, 2, 'Should have 2 added entries');
      assert.ok(ast.unreleased.added.includes('New feature A'), 'Should include feature A');
      assert.ok(ast.unreleased.added.includes('New feature B'), 'Should include feature B');
      assert.strictEqual(ast.unreleased.fixed.length, 1, 'Should have 1 fixed entry');
      assert.ok(ast.unreleased.fixed.includes('Bug fix C'), 'Should include bug fix C');

      // Check releases
      assert.strictEqual(ast.releases.length, 1, 'Should have 1 release');
      assert.strictEqual(ast.releases[0].version, '1.0.0', 'Version should be 1.0.0');
      assert.strictEqual(ast.releases[0].date, '2026-01-15', 'Date should be 2026-01-15');
      assert.strictEqual(ast.releases[0].sections.added.length, 1, 'Release should have 1 added entry');

      // Check links
      assert.strictEqual(ast.links.length, 2, 'Should have 2 links');
    });

    it('extracts all six changelog categories', () => {
      const input = `# Changelog

## [Unreleased]

### Added
- Added item

### Changed
- Changed item

### Deprecated
- Deprecated item

### Removed
- Removed item

### Fixed
- Fixed item

### Security
- Security item
`;

      const ast = changelog.parseChangelog(input);

      assert.strictEqual(ast.unreleased.added.length, 1, 'Should have added');
      assert.strictEqual(ast.unreleased.changed.length, 1, 'Should have changed');
      assert.strictEqual(ast.unreleased.deprecated.length, 1, 'Should have deprecated');
      assert.strictEqual(ast.unreleased.removed.length, 1, 'Should have removed');
      assert.strictEqual(ast.unreleased.fixed.length, 1, 'Should have fixed');
      assert.strictEqual(ast.unreleased.security.length, 1, 'Should have security');
    });

    it('handles empty [Unreleased] section', () => {
      const input = `# Changelog

## [Unreleased]

## [1.0.0] - 2026-01-15

### Added
- Initial release
`;

      const ast = changelog.parseChangelog(input);

      assert.strictEqual(ast.unreleased.added.length, 0, 'Empty unreleased should have no entries');
      assert.strictEqual(ast.releases.length, 1, 'Should still parse releases');
    });

    it('handles CHANGELOG with no releases', () => {
      const input = `# Changelog

## [Unreleased]

### Added
- First feature
`;

      const ast = changelog.parseChangelog(input);

      assert.strictEqual(ast.unreleased.added.length, 1, 'Should parse unreleased');
      assert.strictEqual(ast.releases.length, 0, 'Should have no releases');
      assert.strictEqual(ast.links.length, 0, 'Should have no links');
    });

    it('preserves multiple bullet points per entry', () => {
      const input = `# Changelog

## [Unreleased]

### Added
- Feature with details:
  - Detail A
  - Detail B
- Another feature
`;

      const ast = changelog.parseChangelog(input);

      // Should treat multi-line bullets as single entries
      assert.strictEqual(ast.unreleased.added.length, 2, 'Should have 2 top-level entries');
    });
  });
});
