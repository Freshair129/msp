import { describe, expect, it } from 'vitest'
import { RoutesRecognizer } from '../../../src/symbols/framework/routes.js'

describe('RoutesRecognizer', () => {
  const recognizer = new RoutesRecognizer()
  const root = 'C:/repo'

  it('matches API routes and python files', () => {
    expect(recognizer.matches('C:/repo/pages/api/hello.ts')).toBe(true)
    expect(recognizer.matches('C:/repo/main.py')).toBe(true)
    expect(recognizer.matches('C:/repo/utils/lib.ts')).toBe(false)
  })

  it('recognizes Next.js Pages API route', async () => {
    const path = 'C:/repo/pages/api/users/[id].ts'
    const result = await recognizer.recognize(path, root, '')
    
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].kind).toBe('route')
    expect(result.nodes[0].attrs?.url).toBe('/api/users/[id]')
  })

  it('recognizes FastAPI routes from source', async () => {
    const path = 'C:/repo/app.py'
    const source = `
@app.get("/items/{item_id}")
async function read_item(item_id: int):
    return {"item_id": item_id}

@app.post("/items/")
async function create_item(item: Item):
    return item
    `
    const result = await recognizer.recognize(path, root, source)
    
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].attrs?.url).toBe('/items/{item_id}')
    expect(result.nodes[0].attrs?.method).toBe('GET')
    expect(result.nodes[1].attrs?.method).toBe('POST')
  })
})
