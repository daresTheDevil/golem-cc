# PostgreSQL Skill

## Connection Patterns

### Node.js (pg)
```typescript
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Always use parameterized queries
const result = await pool.query(
  'SELECT * FROM slot_transactions WHERE machine_id = $1 AND txn_date >= $2',
  [machineId, startDate]
)

// Transactions
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('INSERT INTO audit_log (action, user_id) VALUES ($1, $2)', [action, userId])
  await client.query('UPDATE machines SET status = $1 WHERE id = $2', [status, machineId])
  await client.query('COMMIT')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
}
```

## Migration Pattern
```sql
-- migrations/001_create_player_sessions.sql
BEGIN;

CREATE TABLE IF NOT EXISTS player_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(50) NOT NULL,
  machine_id VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_wagered NUMERIC(12,2) DEFAULT 0,
  total_won NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_player_sessions_player ON player_sessions(player_id);
CREATE INDEX idx_player_sessions_machine ON player_sessions(machine_id);
CREATE INDEX idx_player_sessions_started ON player_sessions(started_at);

COMMIT;
```

## Analytics Query Patterns
```sql
-- Player journey: session flow analysis
WITH session_sequence AS (
  SELECT 
    player_id,
    machine_id,
    started_at,
    LAG(machine_id) OVER (PARTITION BY player_id ORDER BY started_at) as prev_machine,
    LAG(ended_at) OVER (PARTITION BY player_id ORDER BY started_at) as prev_ended,
    ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY started_at) as session_num
  FROM player_sessions
  WHERE started_at >= NOW() - INTERVAL '7 days'
)
SELECT 
  player_id,
  prev_machine as from_machine,
  machine_id as to_machine,
  COUNT(*) as transition_count,
  AVG(EXTRACT(EPOCH FROM (started_at - prev_ended))) as avg_gap_seconds
FROM session_sequence
WHERE prev_machine IS NOT NULL
GROUP BY player_id, prev_machine, machine_id
ORDER BY transition_count DESC;
```

## Performance Tips
- Use `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` for query optimization
- Partial indexes for hot queries: `CREATE INDEX ... WHERE active = true`
- `RETURNING` clause eliminates need for follow-up SELECT
- Use CTEs for readability, but know they're optimization fences in PG < 12
- Connection pooling is essential (PgBouncer for production, pool config for dev)
- VACUUM and ANALYZE run automatically, but check `pg_stat_user_tables` for bloat
