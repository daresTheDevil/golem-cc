# Oracle Database Skill

## Connection Patterns

### Node.js (oracledb)
```typescript
import oracledb from 'oracledb'

// Initialize pool once at startup
await oracledb.createPool({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING, // host:port/service_name
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
  poolTimeout: 60,          // seconds to wait for a connection from pool
  queueTimeout: 30000,      // ms to wait in queue before error
})

// Query with bind variables (ALWAYS)
async function getSlotTransactions(machineId: string, startDate: Date) {
  const conn = await oracledb.getConnection()
  try {
    const result = await conn.execute(
      `SELECT machine_id, txn_date, amount, txn_type 
       FROM slot_transactions 
       WHERE machine_id = :machineId 
       AND txn_date >= :startDate
       ORDER BY txn_date DESC
       FETCH FIRST 1000 ROWS ONLY`,
      { machineId, startDate },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    )
    return result.rows
  } finally {
    await conn.close() // Returns to pool
  }
}
```

## Oracle-Specific SQL Gotchas

### Pagination
```sql
-- Oracle 12c+ (preferred)
SELECT player_id, player_name, player_tier, last_visit FROM players ORDER BY last_visit DESC
FETCH FIRST 50 ROWS ONLY;

-- With offset
SELECT player_id, player_name, player_tier, last_visit FROM players ORDER BY last_visit DESC
OFFSET 50 ROWS FETCH NEXT 50 ROWS ONLY;

-- Oracle 11g and below (legacy)
SELECT player_id, player_name, player_tier, last_visit, rnum FROM (
  SELECT a.player_id, a.player_name, a.player_tier, a.last_visit, ROWNUM rnum FROM (
    SELECT player_id, player_name, player_tier, last_visit FROM players ORDER BY last_visit DESC
  ) a WHERE ROWNUM <= 100
) WHERE rnum > 50;
```

### Null Handling
```sql
-- Oracle uses NVL (not COALESCE, though COALESCE works too)
SELECT NVL(player_tier, 'unrated') FROM players;

-- Empty string IS NULL in Oracle (this catches everyone)
SELECT player_id, player_name, player_tier FROM players WHERE player_name IS NOT NULL; -- also excludes ''
```

### Date Handling
```sql
-- Always explicit format masks
SELECT TO_CHAR(txn_date, 'YYYY-MM-DD HH24:MI:SS') FROM transactions;
SELECT txn_id, machine_id, txn_date, amount, txn_type FROM transactions WHERE txn_date >= TO_DATE('2024-01-01', 'YYYY-MM-DD');

-- Current timestamp
SELECT SYSTIMESTAMP FROM DUAL;  -- with timezone
SELECT SYSDATE FROM DUAL;       -- without timezone
```

### Sequences (Not Auto-Increment)
```sql
-- Oracle uses sequences for ID generation
SELECT player_seq.NEXTVAL FROM DUAL;

-- Insert pattern
INSERT INTO players (id, name) VALUES (player_seq.NEXTVAL, :name)
RETURNING id INTO :newId;
```

## Read-Only Safety Patterns

**Enforce at the database level, not in application code.** String-matching
approaches (e.g., checking if a query starts with `SELECT` or `WITH`) are
trivially bypassed. A CTE like `WITH updated AS (UPDATE ... RETURNING *)
SELECT * FROM updated` starts with `WITH` but performs writes. Application-
level regex can never catch every bypass.

### Recommended: Database-Level Read-Only User
```sql
-- Create a read-only user in Oracle (DBA task)
CREATE USER app_readonly IDENTIFIED BY :password;
GRANT CONNECT TO app_readonly;
GRANT SELECT ON schema_name.players TO app_readonly;
GRANT SELECT ON schema_name.transactions TO app_readonly;
-- Repeat for each table. No INSERT/UPDATE/DELETE grants = no writes possible.
```

### Connection Pool for Read-Only Queries
```typescript
// Create a dedicated read-only pool using the restricted user
const readOnlyPool = await oracledb.createPool({
  user: process.env.ORACLE_READONLY_USER,
  password: process.env.ORACLE_READONLY_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: 2,
  poolMax: 10,
  poolAlias: 'READONLY',
})

async function safeQuery(sql: string, binds: Record<string, unknown>) {
  const conn = await oracledb.getConnection('READONLY')
  try {
    return await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })
  } finally {
    await conn.close()
  }
}
// Any INSERT/UPDATE/DELETE attempted on this connection will fail with
// ORA-01031: insufficient privileges — enforced by the database, not bypassable.
```

## Schema Discovery
```sql
-- List tables you have access to
SELECT owner, table_name FROM all_tables WHERE owner = :schema ORDER BY table_name;

-- Describe a table
SELECT column_name, data_type, data_length, nullable 
FROM all_tab_columns 
WHERE owner = :schema AND table_name = :tableName
ORDER BY column_id;

-- Find relationships
SELECT a.constraint_name, a.column_name, 
       c_pk.table_name as referenced_table, b.column_name as referenced_column
FROM all_cons_columns a
JOIN all_constraints c ON a.constraint_name = c.constraint_name
JOIN all_constraints c_pk ON c.r_constraint_name = c_pk.constraint_name
JOIN all_cons_columns b ON c_pk.constraint_name = b.constraint_name
WHERE c.constraint_type = 'R' AND a.owner = :schema;
```
