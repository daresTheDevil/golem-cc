// lib/logger.js — Quiet mode support for golem output

// Quiet mode is enabled if QUIET env var is set to ANY value (including empty string)
const QUIET = process.env.QUIET !== undefined;

/**
 * Log non-essential output (suppressed in quiet mode)
 * @param {string} msg - Message to log
 */
function log(msg) {
  if (!QUIET) {
    console.log(msg);
  }
}

/**
 * Log section heading (suppressed in quiet mode)
 * @param {string} msg - Heading text
 */
function heading(msg) {
  if (!QUIET) {
    console.log(msg);
  }
}

/**
 * Log warning/error (ALWAYS shown, even in quiet mode)
 * Errors are security-critical and must be visible
 * @param {string} msg - Warning message
 */
function warn(msg) {
  console.log(msg);
}

module.exports = {
  log,
  heading,
  warn,
};
