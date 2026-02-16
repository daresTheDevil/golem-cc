# Legacy PHP Development Skill

## First Principles: DO NO HARM

This code has been running in production for years, possibly decades. Your job is NOT to modernize 
everything — it's to make targeted, safe changes while leaving working code alone.

## Triage Protocol

### When You Find Something Scary

**P0 - Fix NOW (hardcoded creds, SQL injection in auth):**
1. Document the finding immediately
2. Create a minimal fix that doesn't break existing behavior
3. Test the fix manually (PHP -l at minimum)
4. Note all locations where the pattern appears
5. Plan broader remediation as separate tasks

**P1 - Fix Soon (XSS, session issues, deprecated functions):**
1. Document with file, line number, and severity
2. Create a ticket/task for remediation
3. Don't fix inline while working on something else

**P2 - Fix Eventually (code style, missing validation on non-sensitive fields):**
1. Note it and move on
2. Fix when you're already modifying that file for other reasons

## Common Legacy Patterns & Safe Fixes

### Hardcoded Credentials
```php
// BEFORE (P0 SECURITY ISSUE)
$conn = mysql_connect("localhost", "root", "casino123!");

// AFTER - Minimal safe fix
$conn = mysqli_connect(
    getenv('DB_HOST') ?: 'localhost',
    getenv('DB_USER') ?: die('DB_USER not set'),
    getenv('DB_PASS') ?: die('DB_PASS not set'),
    getenv('DB_NAME') ?: die('DB_NAME not set')
);
```

### SQL Injection
```php
// BEFORE (P0 SECURITY ISSUE)
$result = mysql_query("SELECT * FROM players WHERE id = " . $_GET['id']);

// AFTER - Parameterized (if using mysqli)
$stmt = $conn->prepare("SELECT id, name, tier, last_visit FROM players WHERE id = ?");
$stmt->bind_param("i", $_GET['id']);
$stmt->execute();
$result = $stmt->get_result();
```

### Deprecated mysql_* Functions
```php
// Map of old → new (when you're already touching the file)
// mysql_connect()     → mysqli_connect() or PDO
// mysql_query()       → mysqli_query() or PDO::query()
// mysql_fetch_array() → mysqli_fetch_array() or PDOStatement::fetch()
// mysql_real_escape() → use prepared statements instead
// mysql_num_rows()    → mysqli_num_rows()
// mysql_error()       → mysqli_error()
```

## Testing Legacy PHP

### When No Test Infrastructure Exists
```php
// Create a minimal test harness
// tests/bootstrap.php
<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Load the same config the app uses
require_once __DIR__ . '/../config.php';

function assert_equals($expected, $actual, $msg = '') {
    if ($expected !== $actual) {
        echo "FAIL: $msg\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        return false;
    }
    echo "PASS: $msg\n";
    return true;
}

function assert_true($value, $msg = '') {
    return assert_equals(true, (bool)$value, $msg);
}
```

### Regression Testing Pattern
```bash
# Before making changes, capture current output
curl -s "http://localhost/page.php?id=123" > tests/snapshots/page-123-before.html

# After changes, compare
curl -s "http://localhost/page.php?id=123" > tests/snapshots/page-123-after.html
diff tests/snapshots/page-123-before.html tests/snapshots/page-123-after.html
```

## Security Scanning Commands
```bash
# Syntax check all PHP files
find . -name "*.php" ! -path "./vendor/*" -exec php -l {} \; 2>&1 | grep -v "No syntax errors"

# Find hardcoded credentials
grep -rn "password\|passwd\|secret\|api_key\|apikey\|token" \
  --include="*.php" --include="*.inc" --include="*.conf" \
  | grep -v "test\|vendor\|node_modules\|\.git" \
  | grep -vi "getenv\|env(\|_ENV\|\$_SERVER"

# Find SQL injection patterns
grep -rn "mysql_query\|mysqli_query\|pg_query" --include="*.php" \
  | grep "\$_\(GET\|POST\|REQUEST\|COOKIE\)"

# Find XSS patterns (unescaped output)
grep -rn "echo.*\$_\(GET\|POST\|REQUEST\)" --include="*.php" \
  | grep -v "htmlspecialchars\|htmlentities\|strip_tags"

# Find file inclusion vulnerabilities
grep -rn "include\|require\|include_once\|require_once" --include="*.php" \
  | grep "\$_\(GET\|POST\|REQUEST\)"
```

## Migration Checklist (PHP → Nuxt/Next)

When porting a PHP file to a modern framework:

1. **Map the route**: What URL does this PHP file serve? → Create equivalent route
2. **Extract queries**: List every SQL query in the file → Create server-side data access functions
3. **Identify business logic**: What transformations happen between DB and output? → Create composables/utilities
4. **Map the template**: What HTML does it output? → Create components
5. **Find dependencies**: What other PHP files does it include? → Map to imports
6. **Check auth**: How does it check permissions? → Implement in middleware
7. **Test equivalence**: Same inputs should produce same outputs (data-wise, not pixel-perfect)

## Absolute Rules for Legacy PHP

1. **NEVER delete a working PHP file** without confirming nothing references it
2. **ALWAYS check for include/require chains** before modifying
3. **ALWAYS test with `php -l`** before committing
4. **NEVER assume the database schema** matches what you'd expect — verify first
5. **Document every change** with inline comments: `// GOLEM: [date] [reason]`
6. **Keep a migration log** in `.golem/logs/migration-tracker.md`
