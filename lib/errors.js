// Rich error context and formatting

const os = require('os');
const path = require('path');
const HOME = os.homedir();

function sanitizePath(filepath) {
  // Replace HOME with ~ to avoid leaking user paths
  if (filepath.startsWith(HOME)) {
    return filepath.replace(HOME, '~');
  }
  return filepath;
}

function formatError({ message, context = {}, diagnostics = {}, suggestion = '' }) {
  const parts = [];

  // Main error message
  parts.push(`Error: ${message}`);

  // Context information
  const allContext = { ...diagnostics, ...context };
  if (Object.keys(allContext).length > 0) {
    parts.push('\nContext:');
    for (const [key, value] of Object.entries(allContext)) {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  // Auto-generate suggestion from diagnostics if not provided
  let finalSuggestion = suggestion;
  if (!finalSuggestion && Object.keys(diagnostics).length > 0) {
    try {
      const diag = require('./diagnostics.js');
      finalSuggestion = diag.suggestFix(diagnostics);
    } catch {
      // Diagnostics module not available, use provided suggestion or none
    }
  }

  // Suggested fix
  if (finalSuggestion) {
    parts.push(`\nSuggested fix:`);
    parts.push(`  ${finalSuggestion}`);
  }

  return parts.join('\n');
}

module.exports = {
  sanitizePath,
  formatError,
};
