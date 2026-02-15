# IBM i (AS/400 / iSeries) Database Skill

## CRITICAL WARNINGS
- These are production systems, often 20-30+ years old
- **READ-ONLY** unless explicitly authorized for writes
- Table/field names are cryptic (6-10 char EBCDIC conventions)
- A bad query can lock a physical file and halt production
- Always test queries with `FETCH FIRST 10 ROWS ONLY` first

## Connection Patterns

### Node.js via ODBC
```typescript
import odbc from 'odbc'

const connectionString = [
  `DRIVER=${process.env.IBMI_DRIVER || '{IBM i Access ODBC Driver}'}`,
  `SYSTEM=${process.env.IBMI_HOST}`,
  `UID=${process.env.IBMI_USER}`,
  `PWD=${process.env.IBMI_PASSWORD}`,
  `NAM=1`,           // Naming convention: 1=System (LIB/FILE), 0=SQL (SCHEMA.TABLE)
  `CMT=0`,           // Commit mode: 0=immediate
  `TRANSLATE=1`,     // EBCDIC → UTF-8
].join(';')

const pool = await odbc.pool(connectionString)

async function query(sql: string, params: unknown[] = []) {
  const conn = await pool.connect()
  try {
    return await conn.query(sql, params)
  } finally {
    await conn.close()
  }
}
```

### Node.js via JT400 (JDBC Bridge)
```typescript
// jt400 package provides native IBM i access
import { connect } from 'jt400'

const connection = await connect({
  host: process.env.IBMI_HOST,
  user: process.env.IBMI_USER,
  password: process.env.IBMI_PASSWORD,
})

const rows = await connection.query(
  'SELECT * FROM CASINOLIB.PLYRMASTR WHERE PLYRNO = ?',
  ['123456']
)
```

## IBM i SQL Dialect Gotchas

### Naming Conventions
```sql
-- System naming (library/file)
SELECT * FROM CASINOLIB/PLYRMASTR;

-- SQL naming (schema.table) - more portable
SELECT * FROM CASINOLIB.PLYRMASTR;

-- Use SQL naming when possible (NAM=0 in connection string)
```

### Data Type Quirks
```sql
-- Fixed-width character fields (always TRIM)
SELECT TRIM(PLYRNO) as player_id, TRIM(PLYRNAME) as player_name 
FROM CASINOLIB.PLYRMASTR;

-- Numeric dates (YYYYMMDD format stored as DECIMAL)
SELECT * FROM CASINOLIB.TXNHIST 
WHERE TXNDATE >= 20240101 AND TXNDATE <= 20241231;

-- Converting numeric date to real date
SELECT DATE(
  SUBSTR(CHAR(TXNDATE), 1, 4) || '-' || 
  SUBSTR(CHAR(TXNDATE), 5, 2) || '-' || 
  SUBSTR(CHAR(TXNDATE), 7, 2)
) as txn_date
FROM CASINOLIB.TXNHIST;

-- Packed decimal amounts (divide by implied decimal)
SELECT TXNAMT / 100.0 as amount FROM CASINOLIB.TXNHIST;
```

### Common Query Patterns
```sql
-- Pagination (DB2 for i)
SELECT * FROM CASINOLIB.PLYRMASTR
ORDER BY PLYRNO
FETCH FIRST 100 ROWS ONLY;

-- OFFSET (requires DB2 for i 7.2+)
SELECT * FROM CASINOLIB.PLYRMASTR
ORDER BY PLYRNO
OFFSET 100 ROWS FETCH FIRST 100 ROWS ONLY;

-- String concatenation
SELECT TRIM(PLYRFNM) CONCAT ' ' CONCAT TRIM(PLYRLNM) as full_name 
FROM CASINOLIB.PLYRMASTR;
-- or use || operator
SELECT TRIM(PLYRFNM) || ' ' || TRIM(PLYRLNM) as full_name
FROM CASINOLIB.PLYRMASTR;
```

## Schema Discovery
```sql
-- List libraries (schemas)
SELECT SCHEMA_NAME FROM QSYS2.SYSSCHEMAS 
WHERE SCHEMA_NAME NOT LIKE 'Q%' 
ORDER BY SCHEMA_NAME;

-- List files (tables) in a library
SELECT TABLE_NAME, TABLE_TEXT 
FROM QSYS2.SYSTABLES 
WHERE TABLE_SCHEMA = 'CASINOLIB'
ORDER BY TABLE_NAME;

-- Describe a file (table columns)
SELECT COLUMN_NAME, DATA_TYPE, LENGTH, NUMERIC_SCALE, IS_NULLABLE, COLUMN_TEXT
FROM QSYS2.SYSCOLUMNS 
WHERE TABLE_SCHEMA = 'CASINOLIB' AND TABLE_NAME = 'PLYRMASTR'
ORDER BY ORDINAL_POSITION;

-- Find indexes / logical files
SELECT INDEX_NAME, COLUMN_NAME 
FROM QSYS2.SYSINDEXES i
JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME
WHERE i.TABLE_SCHEMA = 'CASINOLIB' AND i.TABLE_NAME = 'PLYRMASTR';
```

## Common Field Name Translations
Casino systems often use abbreviated names. Common mappings:

| Field | Likely Meaning |
|-------|---------------|
| PLYRNO | Player Number (ID) |
| PLYRFNM | Player First Name |
| PLYRLNM | Player Last Name |
| TXNDATE | Transaction Date |
| TXNAMT | Transaction Amount |
| TXNTYP | Transaction Type |
| MACHNO | Machine Number |
| MACHTYP | Machine Type |
| LOCCD | Location Code |
| FLRZONE | Floor Zone |
| SESSNBR | Session Number |
| ACTVIND | Active Indicator |

## Safety Rules
1. **ALWAYS use FETCH FIRST N ROWS ONLY** during development
2. **NEVER run UPDATE/DELETE/INSERT** without explicit authorization
3. **Test with a ROWCOUNT check first**: `SELECT COUNT(*) FROM ...` 
4. **Watch for record locks** - keep connections open as briefly as possible
5. **TRIM all character fields** in output to avoid padding issues
6. **Log every query** executed against IBM i for audit
