// Color abstraction with NO_COLOR support
// https://no-color.org/ — respect NO_COLOR env var (any value disables colors)

const DISABLED = process.env.NO_COLOR !== undefined;

const GREEN = DISABLED ? '' : '\x1b[32m';
const YELLOW = DISABLED ? '' : '\x1b[33m';
const RED = DISABLED ? '' : '\x1b[31m';
const CYAN = DISABLED ? '' : '\x1b[36m';
const BOLD = DISABLED ? '' : '\x1b[1m';
const DIM = DISABLED ? '' : '\x1b[2m';
const NC = DISABLED ? '' : '\x1b[0m';

function log(msg) {
  return `${GREEN}[golem]${NC} ${msg}`;
}

function warn(msg) {
  return `${YELLOW}[golem]${NC} ${msg}`;
}

function heading(msg) {
  return `\n${BOLD}${CYAN}${msg}${NC}`;
}

module.exports = {
  GREEN,
  YELLOW,
  RED,
  CYAN,
  BOLD,
  DIM,
  NC,
  log,
  warn,
  heading,
};
