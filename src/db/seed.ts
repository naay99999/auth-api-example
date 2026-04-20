import { ulid } from 'ulidx'
import { users } from './schema'
import { hashPassword } from '../lib/hash'
import { assertDemoSeedAllowed } from './seed-guard'

const DEMO_PASSWORD = 'Password123!'

const demoUsers = [
  { email: 'alex@example.com', name: 'Alex Example' },
  { email: 'maya@example.com', name: 'Maya Example' },
  { email: 'sam@example.com', name: 'Sam Example' },
]

async function seed() {
  assertDemoSeedAllowed(process.env)

  const { db } = await import('./client')
  const now = Math.floor(Date.now() / 1000)

  for (const user of demoUsers) {
    const passwordHash = await hashPassword(DEMO_PASSWORD)

    await db
      .insert(users)
      .values({
        id: ulid(),
        email: user.email,
        passwordHash,
        name: user.name,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash,
          name: user.name,
          updatedAt: now,
        },
      })
  }

  console.log(`Seeded ${demoUsers.length} demo users.`)
  console.log(`Demo password: ${DEMO_PASSWORD}`)
}

seed().catch((error) => {
  console.error('Failed to seed database.')
  console.error(error)
  process.exit(1)
})
