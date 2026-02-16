# Nuxt / Vue 3 Development Skill

## Architecture Patterns

### Composables (The Right Way)
```typescript
// composables/usePlayerSession.ts
export function usePlayerSession(playerId: MaybeRef<string>) {
  const id = toRef(playerId)
  const session = ref<PlayerSession | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null
    try {
      session.value = await $fetch(`/api/players/${id.value}/session`)
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  // Auto-fetch when ID changes
  watch(id, fetch, { immediate: true })

  return { session, loading, error, refresh: fetch }
}
```

### Server Routes
```typescript
// server/api/players/[id]/session.get.ts
import { z } from 'zod'

const ParamsSchema = z.object({
  id: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
  
  const session = await useDatabase().query(
    'SELECT id, player_id, machine_id, started_at, ended_at, total_wagered, total_won FROM player_sessions WHERE player_id = $1 AND active = true',
    [id]
  )
  
  if (!session.rows.length) {
    throw createError({ statusCode: 404, message: 'No active session' })
  }
  
  return session.rows[0]
})
```

### Server Utils (Auto-imported)
```typescript
// server/utils/db.ts
import pg from 'pg'

let pool: pg.Pool | null = null

export function useDatabase(): pg.Pool {
  if (!pool) {
    const config = useRuntimeConfig()
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}
```

## Common Gotchas

### 1. Hydration Mismatches
- Never use `Date.now()`, `Math.random()`, or browser APIs in setup without `onMounted`
- Use `<ClientOnly>` wrapper for browser-only components
- Use `import.meta.client` / `import.meta.server` guards

### 2. useFetch vs $fetch
- `useFetch` in components (handles SSR, dedup, caching)
- `$fetch` in server routes and event handlers
- `useAsyncData` when you need custom keys or transforms

### 3. Runtime Config vs App Config
- `runtimeConfig`: Environment-specific, secrets on server side
- `appConfig`: Build-time, reactive, no secrets

### 4. Auto-imports
- Composables in `composables/` auto-imported
- Utils in `utils/` auto-imported
- Server utils in `server/utils/` auto-imported (server only)
- Components in `components/` auto-imported

## Testing Patterns

### Component Test
```typescript
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PlayerCard from '~/components/PlayerCard.vue'

describe('PlayerCard', () => {
  it('renders player name', async () => {
    const wrapper = await mountSuspended(PlayerCard, {
      props: { player: { id: '1', name: 'Test Player', tier: 'gold' } }
    })
    expect(wrapper.text()).toContain('Test Player')
  })
})
```

### Server Route Test
```typescript
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('/api/players', () => {
  await setup({ server: true })

  it('returns 404 for unknown player', async () => {
    await expect($fetch('/api/players/nonexistent/session'))
      .rejects.toThrow('404')
  })
})
```

## Security Checklist
- [ ] Validate all route params with Zod schemas
- [ ] Use `useRuntimeConfig()` for secrets (never hardcode)
- [ ] Set CORS headers in `nuxt.config.ts` for API routes
- [ ] Use `setCookie` with `httpOnly`, `secure`, `sameSite` flags
- [ ] Sanitize user input before rendering (Vue auto-escapes, but watch `v-html`)
- [ ] Rate limit API endpoints
- [ ] Never expose database connection strings to client
