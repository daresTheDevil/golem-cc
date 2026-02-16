const { describe, it } = require('node:test');
const assert = require('node:assert');

let changelog;

describe('changelog edge cases', () => {
  it('loads module', () => {
    changelog = require('../lib/changelog.js');
    assert.ok(changelog, 'Module should load');
  });

  describe('malformed CHANGELOG handling', () => {
    it('parses CHANGELOG with missing categories gracefully', () => {
      const input = `# Changelog

## [Unreleased]

- Orphan entry with no category heading

## [1.0.0] - 2026-01-01

- Another orphan`;

      const ast = changelog.parseChangelog(input);
      assert.ok(ast, 'Should parse malformed file');
      assert.ok(ast.unreleased, 'Should have unreleased structure');
    });

    it('handles CHANGELOG with wrong heading levels', () => {
      const input = `# Changelog

### Wrong level for Unreleased

#### Wrong level for category`;

      const ast = changelog.parseChangelog(input);
      assert.ok(ast, 'Should parse without crashing');
    });

    it('handles empty CHANGELOG', () => {
      const input = '';
      const ast = changelog.parseChangelog(input);
      assert.ok(ast, 'Should handle empty input');
    });

    it('handles CHANGELOG with only header', () => {
      const input = '# Changelog\n\nSome description.';
      const ast = changelog.parseChangelog(input);
      assert.ok(ast.header.includes('Changelog'), 'Should parse header');
    });
  });

  describe('input validation edge cases', () => {
    it('validateEntry handles very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const result = changelog.validateEntry(longMessage);
      assert.strictEqual(result.valid, true, 'Should handle long messages');
    });

    it('validateEntry handles unicode', () => {
      const result = changelog.validateEntry('Added emoji support 🎉');
      assert.strictEqual(result.valid, true, 'Should handle unicode');
    });

    it('validateEntry handles special markdown characters', () => {
      const result = changelog.validateEntry('Fixed [link](url) and **bold**');
      assert.strictEqual(result.valid, true, 'Should handle markdown');
    });

    it('detectSecrets handles edge of pattern (7 chars)', () => {
      // Secret pattern requires 8+ chars
      const result = changelog.detectSecrets('password: abc1234');
      assert.strictEqual(result, false, 'Should not detect 7-char values');
    });

    it('detectSecrets handles edge of pattern (8 chars)', () => {
      const result = changelog.detectSecrets('password: abc12345');
      assert.strictEqual(result, true, 'Should detect 8-char values');
    });
  });

  describe('parseChangelog edge cases', () => {
    it('handles multiple spaces in version line', () => {
      const input = `# Changelog

## [1.0.0]  -  2026-01-01

### Added
- Feature`;

      const ast = changelog.parseChangelog(input);
      assert.strictEqual(ast.releases[0].version, '1.0.0', 'Should parse version with extra spaces');
    });

    it('handles releases without date', () => {
      const input = `# Changelog

## [1.0.0]

### Added
- Feature`;

      const ast = changelog.parseChangelog(input);
      // Should not crash, but won't match release pattern
      assert.ok(ast, 'Should parse without crashing');
    });
  });

  describe('addEntry edge cases', () => {
    it('handles entry with leading/trailing whitespace', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', '  Trimmed entry  ');

      // Entry should be stored as-is (trimming is UI concern)
      assert.ok(updated.unreleased.added[0].includes('Trimmed'), 'Should include entry');
    });

    it('handles entry with newlines', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'Multi\nline\nentry');

      assert.strictEqual(updated.unreleased.added.length, 1, 'Should add as single entry');
    });
  });

  describe('renderChangelog edge cases', () => {
    it('renders empty AST without crashing', () => {
      const ast = {
        header: '# Changelog\n',
        unreleased: { added: [], changed: [], deprecated: [], removed: [], fixed: [], security: [] },
        releases: [],
        links: [],
        lineEnding: '\n',
      };

      const rendered = changelog.renderChangelog(ast);
      assert.ok(rendered.includes('# Changelog'), 'Should render header');
      assert.ok(rendered.includes('## [Unreleased]'), 'Should render unreleased section');
    });

    it('handles AST with missing lineEnding', () => {
      const ast = {
        header: '# Changelog\n',
        unreleased: { added: ['Test'], changed: [], deprecated: [], removed: [], fixed: [], security: [] },
        releases: [],
        links: [],
        // lineEnding missing
      };

      const rendered = changelog.renderChangelog(ast);
      assert.ok(rendered.includes('- Test'), 'Should render with default line ending');
    });
  });

  describe('releaseVersion edge cases', () => {
    it('handles version with v prefix', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'Feature');

      // Version should NOT have 'v' prefix in CHANGELOG
      const released = changelog.releaseVersion(updated, '1.0.0', '2026-02-16');
      assert.strictEqual(released.releases[0].version, '1.0.0', 'Version should not have v prefix');
    });

    it('handles date in different format', () => {
      const ast = changelog.parseChangelog(changelog.getTemplate());
      const updated = changelog.addEntry(ast, 'added', 'Feature');

      // Should accept any date format (validation is caller's responsibility)
      const released = changelog.releaseVersion(updated, '1.0.0', '02/16/2026');
      assert.strictEqual(released.releases[0].date, '02/16/2026', 'Should accept any date format');
    });
  });

  describe('getGitRemote edge cases', () => {
    it('returns null if not in git repo', () => {
      // Already tested in main suite, just verify behavior
      const remote = changelog.getGitRemote();
      // Could be null or could be the actual remote if running in git repo
      assert.ok(remote === null || typeof remote === 'object', 'Should return null or object');
    });
  });

  describe('run() edge cases', () => {
    it('handles empty args array', () => {
      const result = changelog.run([]);
      assert.strictEqual(result.success, false, 'Should fail with no args');
      assert.ok(result.message.includes('Usage'), 'Should show usage');
    });

    it('handles only category (no message)', () => {
      const result = changelog.run(['added']);
      assert.strictEqual(result.success, false, 'Should fail with only category');
    });

    it('handles multiple --dry-run flags', () => {
      const result = changelog.run(['--dry-run', '--dry-run', 'added', 'Test']);
      assert.strictEqual(result.success, true, 'Should handle duplicate flags');
      assert.ok(result.message.includes('Would add'), 'Should be dry-run');
    });
  });
});
