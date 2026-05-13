import { describe, expect, it } from 'vitest'
import { OrmRecognizer } from '../../../src/symbols/framework/orm.js'

describe('OrmRecognizer', () => {
  const recognizer = new OrmRecognizer()
  const root = 'C:/repo'

  it('matches prisma and drizzle files', () => {
    expect(recognizer.matches('C:/repo/prisma/schema.prisma')).toBe(true)
    expect(recognizer.matches('C:/repo/src/db/schema.ts')).toBe(true)
    expect(recognizer.matches('C:/repo/src/utils.ts')).toBe(false)
  })

  it('recognizes Prisma models', async () => {
    const source = `
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
}
    `
    const result = await recognizer.recognize('C:/repo/schema.prisma', root, source)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].name).toBe('User')
    expect(result.nodes[0].attrs?.orm).toBe('prisma')
  })

  it('recognizes Drizzle tables', async () => {
    const source = `
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
});
    `
    const result = await recognizer.recognize('C:/repo/db/schema.ts', root, source)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].name).toBe('users')
    expect(result.nodes[0].attrs?.orm).toBe('drizzle')
  })
})
