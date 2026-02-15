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
SELECT * FROM players ORDER BY last_visit DESC
FETCH FIRST 50 ROWS ONLY;

-- With offset
SELECT * FROM players ORDER BY last_visit DESC
OFFSET 50 ROWS FETCH NEXT 50 ROWS ONLY;

-- Oracle 11g and below (legacy)
SELECT * FROM (
  SELECT a.*, ROWNUM rnum FROM (
    SELECT * FROM players ORDER BY last_visit DESC
  ) a WHERE ROWNUM <= 100
) WHERE rnum > 50;
```

### Null Handling
```sql
-- Oracle uses NVL (not COALESCE, though COALESCE works too)
SELECT NVL(player_tier, 'unrated') FROM players;

-- Empty string IS NULL in Oracle (this catches everyone)
SELECT * FROM players WHERE player_name IS NOT NULL; -- also excludes ''
```

### Date Handling
```sql
-- Always explicit format masks
SELECT TO_CHAR(txn_date, 'YYYY-MM-DD HH24:MI:SS') FROM transactions;
SELECT * FROM transactions WHERE txn_date >= TO_DATE('2024-01-01', 'YYYY-MM-DD');

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
```typescript
// Wrap all Oracle queries with read-only guarantee
async function safeQuery(sql: string, binds: Record<string, unknown>) {
  // Prevent accidental writes
  const normalized = sql.trim().toUpperCase()
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    throw new Error('Only SELECT queries allowed on Oracle connection')
  }
  
  const conn = await oracledb.getConnection()
  try {
    return await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })
  } finally {
    await conn.close()
  }
}
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
