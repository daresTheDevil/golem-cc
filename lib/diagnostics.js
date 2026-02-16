// System state detection for rich error messages

const fs = require('fs');
const path = require('path');

function detectState(golemHome) {
  const state = {
    golemHomeExists: false,
    versionFileExists: false,
    versionCorrupted: false,
    version: null,
    templatesExist: false,
    isPartialInstall: false,
  };

  // Check GOLEM_HOME
  if (!fs.existsSync(golemHome)) {
    return state;
  }
  state.golemHomeExists = true;

  // Check version file
  const versionFile = path.join(golemHome, 'version');
  if (fs.existsSync(versionFile)) {
    state.versionFileExists = true;
    try {
      const version = fs.readFileSync(versionFile, 'utf-8').trim();
      if (!version || version.length === 0) {
        state.versionCorrupted = true;
      } else {
        state.version = version;
      }
    } catch {
      state.versionCorrupted = true;
    }
  }

  // Check templates directory
  const templatesDir = path.join(golemHome, 'templates');
  state.templatesExist = fs.existsSync(templatesDir);

  // Detect partial install
  if (state.golemHomeExists && (!state.versionFileExists || !state.templatesExist)) {
    state.isPartialInstall = true;
  }

  return state;
}

function suggestFix(state) {
  // Missing GOLEM_HOME entirely
  if (!state.golemHomeExists) {
    return 'Run: pnpm dlx golem-cc';
  }

  // Corrupted version file
  if (state.versionCorrupted) {
    return 'Version file is corrupted. Run: golem repair (or reinstall: pnpm dlx golem-cc)';
  }

  // Partial install
  if (state.isPartialInstall) {
    return 'Partial installation detected. Run: golem repair (or reinstall: pnpm dlx golem-cc)';
  }

  return 'Run: golem doctor';
}

module.exports = {
  detectState,
  suggestFix,
};
