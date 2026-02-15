# Next.js / React Development Skill

## Architecture Patterns

### Server Components (Default)
```tsx
// app/players/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getPlayerSession } from '@/lib/db/players'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params
  const session = await getPlayerSession(id)
  
  if (!session) notFound()
  
  return (
    <div>
      <h1>{session.playerName}</h1>
      <SessionDetails session={session} />
    </div>
  )
}
```

### Client Components (When Needed)
```tsx
'use client'

import { useState, useTransition } from 'react'
import { updatePlayerTier } from '@/app/actions/players'

export function TierSelector({ playerId, currentTier }: Props) {
  const [tier, setTier] = useState(currentTier)
  const [isPending, startTransition] = useTransition()

  const handleChange = (newTier: string) => {
    setTier(newTier)
    startTransition(async () => {
      await updatePlayerTier(playerId, newTier)
    })
  }

  return (
    <select value={tier} onChange={e => handleChange(e.target.value)} disabled={isPending}>
      <option value="bronze">Bronze</option>
      <option value="silver">Silver</option>
      <option value="gold">Gold</option>
    </select>
  )
}
```

### Server Actions
```tsx
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'

const UpdateTierSchema = z.object({
  playerId: z.string().uuid(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
})

export async function updatePlayerTier(playerId: string, tier: string) {
  const validated = UpdateTierSchema.parse({ playerId, tier })
  
  await db.query(
    'UPDATE players SET tier = $1, updated_at = NOW() WHERE id = $2',
    [validated.tier, validated.playerId]
  )
  
  revalidatePath(`/players/${validated.playerId}`)
}
```

### Data Access Layer
```typescript
// lib/db/index.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
})

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  getClient: () => pool.connect(),
}
```

## Common Gotchas

### 1. Server vs Client Boundary
- Default = Server Component. Add `'use client'` only when you need interactivity
- Server Components can import Client Components, not vice versa
- Pass serializable props across the boundary

### 2. Caching Behavior
- `fetch()` in Server Components is cached by default
- Use `{ cache: 'no-store' }` or `{ next: { revalidate: 60 } }` to control
- `revalidatePath()` and `revalidateTag()` for on-demand revalidation

### 3. Middleware
- `middleware.ts` at project root runs on EVERY request
- Keep it fast - no database calls
- Use for auth checks, redirects, header manipulation

## Testing Patterns

### Component Test
```tsx
import { render, screen } from '@testing-library/react'
import { PlayerCard } from '@/components/PlayerCard'

describe('PlayerCard', () => {
  it('renders player name', () => {
    render(<PlayerCard player={{ id: '1', name: 'Test', tier: 'gold' }} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

### Server Action Test
```typescript
import { describe, it, expect, vi } from 'vitest'
import { updatePlayerTier } from '@/app/actions/players'

vi.mock('@/lib/db', () => ({
  db: { query: vi.fn() }
}))

describe('updatePlayerTier', () => {
  it('rejects invalid tier', async () => {
    await expect(updatePlayerTier('uuid', 'invalid'))
      .rejects.toThrow()
  })
})
```

## Security Checklist
- [ ] Validate all inputs in Server Actions with Zod
- [ ] Use environment variables for secrets (never in client code)
- [ ] Set security headers in `next.config.js` or middleware
- [ ] CSRF protection is built into Server Actions (verify it's working)
- [ ] Never expose internal IDs or stack traces to client
- [ ] Use `headers()` and `cookies()` functions, not raw request parsing
