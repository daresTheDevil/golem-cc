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

  describe('validateEntry', () => {
    it('accepts valid entry', () => {
      const result = changelog.validateEntry('Added new feature');
      assert.strictEqual(result.valid, true, 'Valid entry should pass');
      assert.strictEqual(result.error, undefined, 'Should have no error');
    });

    it('rejects empty string', () => {
      const result = changelog.validateEntry('');
      assert.strictEqual(result.valid, false, 'Empty string should fail');
      assert.ok(result.error.includes('empty'), 'Error should mention empty');
    });

    it('rejects whitespace-only string', () => {
      const result = changelog.validateEntry('   \t  \n  ');
      assert.strictEqual(result.valid, false, 'Whitespace-only should fail');
      assert.ok(result.error.includes('empty'), 'Error should mention empty');
    });

    it('sanitizes markdown heading conflicts', () => {
      const result = changelog.validateEntry('Added ## new section');
      assert.strictEqual(result.valid, true, 'Should sanitize and accept');
      assert.ok(result.sanitized, 'Should provide sanitized version');
      assert.ok(result.sanitized.includes('\\##'), 'Should escape ##');
    });
  });

  describe('detectSecrets', () => {
    it('detects api_key pattern', () => {
      const result = changelog.detectSecrets('Added api_key: abc123def456');
      assert.strictEqual(result, true, 'Should detect api_key');
    });

    it('detects password pattern', () => {
      const result = changelog.detectSecrets('Fixed password: s3cr3tP@ss');
      assert.strictEqual(result, true, 'Should detect password');
    });

    it('detects token pattern', () => {
      const result = changelog.detectSecrets('Updated token: ghp_1234567890abcdef');
      assert.strictEqual(result, true, 'Should detect token');
    });

    it('detects API_KEY (uppercase)', () => {
      const result = changelog.detectSecrets('Added API_KEY=abc123def456');
      assert.strictEqual(result, true, 'Should detect uppercase API_KEY');
    });

    it('detects apiKey (camelCase)', () => {
      const result = changelog.detectSecrets('Set apiKey: abc123def');
      assert.strictEqual(result, true, 'Should detect camelCase apiKey');
    });

    it('allows "password" in context', () => {
      const result = changelog.detectSecrets('Added password field to form');
      assert.strictEqual(result, false, 'Should allow "password" without value');
    });

    it('allows "token" in context', () => {
      const result = changelog.detectSecrets('Fixed token validation logic');
      assert.strictEqual(result, false, 'Should allow "token" without value');
    });

    it('detects secret pattern', () => {
      const result = changelog.detectSecrets('Added secret: abc123xyz');
      assert.strictEqual(result, true, 'Should detect secret');
    });

    it('detects credential pattern', () => {
      const result = changelog.detectSecrets('Fixed credential abc123xyz');
      assert.strictEqual(result, true, 'Should detect credential');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('escapes heading conflicts', () => {
      const result = changelog.sanitizeMarkdown('Added ## heading');
      assert.strictEqual(result, 'Added \\## heading', 'Should escape ##');
    });

    it('leaves single # alone (not a heading at line start)', () => {
      const result = changelog.sanitizeMarkdown('Added #hashtag support');
      assert.strictEqual(result, 'Added #hashtag support', 'Should leave # alone in middle of text');
    });

    it('escapes multiple ### patterns', () => {
      const result = changelog.sanitizeMarkdown('## heading ## another ##');
      assert.ok(result.includes('\\##'), 'Should escape all ##');
    });

    it('preserves normal markdown', () => {
      const result = changelog.sanitizeMarkdown('Added **bold** and *italic* text');
      assert.strictEqual(result, 'Added **bold** and *italic* text', 'Should preserve normal markdown');
    });
  });

  describe('suggestCategory', () => {
    it('suggests "fixed" for "fixes"', () => {
      const result = changelog.suggestCategory('fixes');
      assert.strictEqual(result, 'fixed', 'Should suggest fixed');
    });

    it('suggests "added" for "adds"', () => {
      const result = changelog.suggestCategory('adds');
      assert.strictEqual(result, 'added', 'Should suggest added');
    });

    it('suggests "added" for "add"', () => {
      const result = changelog.suggestCategory('add');
      assert.strictEqual(result, 'added', 'Should suggest added');
    });

    it('suggests "changed" for "change"', () => {
      const result = changelog.suggestCategory('change');
      assert.strictEqual(result, 'changed', 'Should suggest changed');
    });

    it('suggests "removed" for "remove"', () => {
      const result = changelog.suggestCategory('remove');
      assert.strictEqual(result, 'removed', 'Should suggest removed');
    });

    it('returns null for invalid category', () => {
      const result = changelog.suggestCategory('invalid123');
      assert.strictEqual(result, null, 'Should return null for invalid');
    });

    it('is case-insensitive', () => {
      const result = changelog.suggestCategory('FIXES');
      assert.strictEqual(result, 'fixed', 'Should handle uppercase');
    });
  });

  describe('addEntry', () => {
    it('adds entry to existing category', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'New feature X');

      assert.strictEqual(updated.unreleased.added.length, 1, 'Should have 1 entry');
      assert.strictEqual(updated.unreleased.added[0], 'New feature X', 'Entry should match');
    });

    it('creates category if missing', () => {
      const ast = {
        header: '# Changelog\n',
        unreleased: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] },
        releases: [],
        links: [],
      };

      const updated = changelog.addEntry(ast, 'security', 'Fixed XSS vulnerability');

      assert.strictEqual(updated.unreleased.security.length, 1, 'Should have 1 security entry');
      assert.strictEqual(updated.unreleased.security[0], 'Fixed XSS vulnerability', 'Entry should match');
    });

    it('deduplicates identical entries', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      let updated = changelog.addEntry(ast, 'added', 'Duplicate feature');
      updated = changelog.addEntry(updated, 'added', 'Duplicate feature');

      assert.strictEqual(updated.unreleased.added.length, 1, 'Should deduplicate');
      assert.strictEqual(updated.unreleased.added[0], 'Duplicate feature', 'Entry should match');
    });

    it('prepends new entries (newest first)', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      let updated = changelog.addEntry(ast, 'added', 'First entry');
      updated = changelog.addEntry(updated, 'added', 'Second entry');

      assert.strictEqual(updated.unreleased.added.length, 2, 'Should have 2 entries');
      assert.strictEqual(updated.unreleased.added[0], 'Second entry', 'Newest should be first');
      assert.strictEqual(updated.unreleased.added[1], 'First entry', 'Oldest should be last');
    });
  });

  describe('renderChangelog', () => {
    it('produces valid Keep a Changelog format', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'Test feature');
      const rendered = changelog.renderChangelog(updated);

      assert.ok(rendered.includes('# Changelog'), 'Should have main heading');
      assert.ok(rendered.includes('## [Unreleased]'), 'Should have unreleased section');
      assert.ok(rendered.includes('### Added'), 'Should have Added category');
      assert.ok(rendered.includes('- Test feature'), 'Should have entry');
    });

    it('maintains category order after additions', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      let updated = changelog.addEntry(ast, 'fixed', 'Bug fix');
      updated = changelog.addEntry(updated, 'added', 'New feature');
      updated = changelog.addEntry(updated, 'security', 'Security patch');

      const rendered = changelog.renderChangelog(updated);

      // Categories must appear in order: Added, Changed, Deprecated, Removed, Fixed, Security
      const addedIndex = rendered.indexOf('### Added');
      const fixedIndex = rendered.indexOf('### Fixed');
      const securityIndex = rendered.indexOf('### Security');

      assert.ok(addedIndex < fixedIndex, 'Added should come before Fixed');
      assert.ok(fixedIndex < securityIndex, 'Fixed should come before Security');
    });

    it('omits empty categories', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'Only added');
      const rendered = changelog.renderChangelog(updated);

      assert.ok(rendered.includes('### Added'), 'Should include Added (has entries)');
      assert.ok(!rendered.includes('### Changed'), 'Should omit Changed (empty)');
      assert.ok(!rendered.includes('### Deprecated'), 'Should omit Deprecated (empty)');
    });

    it('preserves line endings from original', () => {
      const crlfTemplate = changelog.getTemplate().replace(/\n/g, '\r\n');
      const ast = changelog.parseChangelog(crlfTemplate);
      const updated = changelog.addEntry(ast, 'added', 'Feature');
      const rendered = changelog.renderChangelog(updated);

      assert.ok(rendered.includes('\r\n'), 'Should preserve CRLF line endings');
    });
  });

  describe('releaseVersion', () => {
    it('moves [Unreleased] to new version section', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      let updated = changelog.addEntry(ast, 'added', 'Feature A');
      updated = changelog.addEntry(updated, 'fixed', 'Bug B');

      const released = changelog.releaseVersion(updated, '1.2.3', '2026-02-16');

      // [Unreleased] should be empty
      assert.strictEqual(released.unreleased.added.length, 0, 'Unreleased added should be empty');
      assert.strictEqual(released.unreleased.fixed.length, 0, 'Unreleased fixed should be empty');

      // New release should exist
      assert.strictEqual(released.releases.length, 1, 'Should have 1 release');
      assert.strictEqual(released.releases[0].version, '1.2.3', 'Version should match');
      assert.strictEqual(released.releases[0].date, '2026-02-16', 'Date should match');
      assert.strictEqual(released.releases[0].sections.added.length, 1, 'Release should have added entry');
      assert.strictEqual(released.releases[0].sections.fixed.length, 1, 'Release should have fixed entry');
    });

    it('creates empty [Unreleased] after move', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'Feature');
      const released = changelog.releaseVersion(updated, '1.0.0', '2026-02-16');

      // Should have empty unreleased
      assert.strictEqual(released.unreleased.added.length, 0, 'Should reset unreleased');
    });

    it('fails if version already exists', () => {
      const input = `# Changelog

## [Unreleased]

### Added
- New feature

## [1.0.0] - 2026-01-01

### Added
- Initial release
`;
      const ast = changelog.parseChangelog(input);

      assert.throws(() => {
        changelog.releaseVersion(ast, '1.0.0', '2026-02-16');
      }, /already exists/, 'Should throw if version exists');
    });

    it('handles empty [Unreleased] (no-op)', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const result = changelog.releaseVersion(ast, '1.0.0', '2026-02-16');

      // Should return null or unchanged AST to signal nothing to release
      assert.strictEqual(result, null, 'Should return null for empty unreleased');
    });

    it('prepends new release (newest first)', () => {
      const input = `# Changelog

## [Unreleased]

### Added
- New feature

## [1.0.0] - 2026-01-01

### Added
- Initial release
`;
      const ast = changelog.parseChangelog(input);
      const released = changelog.releaseVersion(ast, '1.1.0', '2026-02-16');

      assert.strictEqual(released.releases.length, 2, 'Should have 2 releases');
      assert.strictEqual(released.releases[0].version, '1.1.0', 'Newest release should be first');
      assert.strictEqual(released.releases[1].version, '1.0.0', 'Older release should be second');
    });
  });

  describe('getGitRemote', () => {
    it('returns remote URL and host for GitHub', () => {
      const remote = changelog.getGitRemote();

      if (remote) {
        assert.ok(remote.url, 'Should have URL');
        assert.ok(remote.host, 'Should have host');
        assert.ok(typeof remote.url === 'string', 'URL should be string');
        assert.ok(typeof remote.host === 'string', 'Host should be string');
      } else {
        // If no remote, that's OK (not in a git repo or no remote configured)
        assert.strictEqual(remote, null, 'Should return null if no remote');
      }
    });
  });

  describe('generateComparisonLinks', () => {
    it('generates links for GitHub URLs', () => {
      const ast = {
        releases: [
          { version: '1.1.0', date: '2026-02-16', sections: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] } },
          { version: '1.0.0', date: '2026-01-01', sections: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] } },
        ],
      };
      const remote = { url: 'https://github.com/user/repo.git', host: 'github.com' };
      const links = changelog.generateComparisonLinks(ast, remote);

      assert.ok(Array.isArray(links), 'Should return array');
      assert.ok(links.length > 0, 'Should have links');
      assert.ok(links[0].includes('[Unreleased]'), 'Should have Unreleased link');
      assert.ok(links[0].includes('v1.1.0...HEAD'), 'Should compare latest to HEAD');
    });

    it('returns empty array with no remote', () => {
      const ast = { releases: [] };
      const links = changelog.generateComparisonLinks(ast, null);

      assert.ok(Array.isArray(links), 'Should return array');
      assert.strictEqual(links.length, 0, 'Should be empty without remote');
    });

    it('handles no previous tags (first release)', () => {
      const ast = {
        releases: [
          { version: '1.0.0', date: '2026-02-16', sections: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] } },
        ],
      };
      const remote = { url: 'https://github.com/user/repo.git', host: 'github.com' };
      const links = changelog.generateComparisonLinks(ast, remote);

      assert.ok(links.length > 0, 'Should have links');
      assert.ok(links.some(l => l.includes('[1.0.0]:')), 'Should have link to first release tag');
    });

    it('converts SSH URLs to HTTPS', () => {
      const ast = {
        releases: [{ version: '1.0.0', date: '2026-02-16', sections: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] } }],
      };
      const remote = { url: 'git@github.com:user/repo.git', host: 'github.com' };
      const links = changelog.generateComparisonLinks(ast, remote);

      assert.ok(links[0].includes('https://'), 'Should convert to HTTPS');
      assert.ok(!links[0].includes('git@'), 'Should not contain SSH format');
    });
  });

  describe('versionExists', () => {
    it('returns true if version exists', () => {
      const ast = {
        releases: [
          { version: '1.0.0', date: '2026-01-01', sections: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] } },
        ],
      };

      assert.strictEqual(changelog.versionExists(ast, '1.0.0'), true, 'Should find existing version');
    });

    it('returns false if version does not exist', () => {
      const ast = {
        releases: [
          { version: '1.0.0', date: '2026-01-01', sections: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] } },
        ],
      };

      assert.strictEqual(changelog.versionExists(ast, '2.0.0'), false, 'Should not find non-existent version');
    });

    it('returns false for empty releases', () => {
      const ast = { releases: [] };

      assert.strictEqual(changelog.versionExists(ast, '1.0.0'), false, 'Should return false for empty');
    });
  });
});
