// Rich error context and formatting

const os = require('os');
const HOME = os.homedir();

function sanitizePath(filepath) {
  // Replace HOME with ~ to avoid leaking user paths
  if (filepath.startsWith(HOME)) {
    return filepath.replace(HOME, '~');
  }
  return filepath;
}

function formatError({ message, context = {}, suggestion = '' }) {
  const parts = [];

  // Main error message
  parts.push(`Error: ${message}`);

  // Context information
  if (Object.keys(context).length > 0) {
    parts.push('\nContext:');
    for (const [key, value] of Object.entries(context)) {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  // Suggested fix
  if (suggestion) {
    parts.push(`\nSuggested fix:`);
    parts.push(`  ${suggestion}`);
  }

  return parts.join('\n');
}

module.exports = {
  sanitizePath,
  formatError,
};
