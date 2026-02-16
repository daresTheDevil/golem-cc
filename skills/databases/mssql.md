# SQL Server Database Skill

## Connection Patterns

### Node.js (mssql/tedious)
```typescript
import sql from 'mssql'

const config: sql.config = {
  server: process.env.MSSQL_HOST!,
  database: process.env.MSSQL_DATABASE!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.NODE_ENV !== 'production',
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 5000,
  requestTimeout: 30000,
}

const pool = await sql.connect(config)

// Parameterized queries (ALWAYS)
async function getTransactions(machineId: string, limit: number = 100) {
  const result = await pool.request()
    .input('machineId', sql.VarChar(50), machineId)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) TxnId, MachineId, TxnDate, Amount, TxnType
      FROM Transactions
      WHERE MachineId = @machineId
      ORDER BY TxnDate DESC
    `)
  return result.recordset
}

// Transactions
async function transferCredits(fromPlayer: string, toPlayer: string, amount: number) {
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const request = new sql.Request(transaction)
    await request
      .input('from', sql.VarChar, fromPlayer)
      .input('amount', sql.Decimal(12, 2), amount)
      .query('UPDATE Players SET Credits = Credits - @amount WHERE PlayerId = @from')
    await request
      .input('to', sql.VarChar, toPlayer)
      .query('UPDATE Players SET Credits = Credits + @amount WHERE PlayerId = @to')
    await transaction.commit()
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}
```

## SQL Server Specific Patterns
```sql
-- Pagination
SELECT PlayerId, Name, Tier, LastVisit FROM Players
ORDER BY LastVisit DESC
OFFSET 50 ROWS FETCH NEXT 50 ROWS ONLY;

-- SCOPE_IDENTITY (not @@IDENTITY)
INSERT INTO Players (Name, Tier) VALUES (@name, @tier);
SELECT SCOPE_IDENTITY() as NewId;

-- MERGE for upsert
MERGE INTO PlayerStats AS target
USING (SELECT @playerId as PlayerId, @totalWagered as TotalWagered) AS source
ON target.PlayerId = source.PlayerId
WHEN MATCHED THEN
  UPDATE SET TotalWagered = TotalWagered + source.TotalWagered
WHEN NOT MATCHED THEN
  INSERT (PlayerId, TotalWagered) VALUES (source.PlayerId, source.TotalWagered);

-- TRY...CATCH
BEGIN TRY
  BEGIN TRANSACTION;
  -- work here
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  ROLLBACK TRANSACTION;
  THROW;
END CATCH;
```

## Schema Discovery
```sql
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = @tableName ORDER BY ORDINAL_POSITION;
```
