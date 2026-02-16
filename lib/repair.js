// lib/repair.js — Repair broken GOLEM_HOME installations

const fs = require('fs');
const path = require('path');
const diagnostics = require('./diagnostics.js');

/**
 * Detect broken state and determine repair strategy
 * @param {string} golemHome - Path to GOLEM_HOME
 * @returns {Object} { issues: string[], strategy: string }
 */
function detectBrokenState(golemHome) {
  const state = diagnostics.detectState(golemHome);
  const issues = [];

  if (!state.golemHomeExists) {
    issues.push('GOLEM_HOME does not exist');
    return { issues, strategy: 'reinstall', state };
  }

  if (state.versionCorrupted) {
    issues.push('Version file is corrupted or empty');
  }

  if (!state.versionFileExists) {
    issues.push('Version file is missing');
  }

  if (!state.templatesExist) {
    issues.push('Templates directory is missing');
  }

  // Check for bin/golem
  const golemBin = path.join(golemHome, 'bin/golem');
  if (!fs.existsSync(golemBin)) {
    issues.push('CLI binary (bin/golem) is missing');
  }

  // Check for lib/
  const libDir = path.join(golemHome, 'lib');
  if (!fs.existsSync(libDir)) {
    issues.push('Library directory (lib/) is missing');
  }

  // Determine strategy
  let strategy = 'none';
  if (issues.length > 0) {
    strategy = 'reinstall'; // Simple strategy: just reinstall everything
  }

  return { issues, strategy, state };
}

/**
 * Execute repair strategy
 * @param {string} golemHome - Path to GOLEM_HOME
 * @param {Object} options - { dryRun: boolean, force: boolean }
 * @returns {Object} { success: boolean, message: string }
 */
function executeRepair(golemHome, options = {}) {
  const { dryRun = false, force = false } = options;

  const diagnosis = detectBrokenState(golemHome);

  if (diagnosis.issues.length === 0) {
    return {
      success: true,
      message: 'No issues detected. GOLEM_HOME is healthy.',
      issues: []
    };
  }

  if (dryRun) {
    return {
      success: true,
      message: `Found ${diagnosis.issues.length} issue(s). Run without --dry-run to fix.`,
      issues: diagnosis.issues,
      strategy: diagnosis.strategy
    };
  }

  if (!force) {
    return {
      success: false,
      message: 'Repair requires confirmation. Run with --confirm or --force to proceed.',
      issues: diagnosis.issues,
      needsConfirmation: true
    };
  }

  // Execute repair strategy
  if (diagnosis.strategy === 'reinstall') {
    // Strategy: Reinstall by running the installer
    // This is delegated to the CLI (can't directly call installer from lib)
    return {
      success: true,
      message: 'Repair strategy: reinstall GOLEM_HOME',
      issues: diagnosis.issues,
      strategy: 'reinstall',
      action: 'run_installer'
    };
  }

  return {
    success: false,
    message: 'Unknown repair strategy',
    issues: diagnosis.issues
  };
}

module.exports = {
  detectBrokenState,
  executeRepair,
};
