import fs from 'fs'
import path from 'path'
import { initDb, run } from '../src/db.js'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: tsx scripts/import-floorplan.ts <path-to-floorplan.txt>')
  process.exit(1)
}

const resolvedPath = path.resolve(filePath)
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`)
  process.exit(1)
}

const raw = fs.readFileSync(resolvedPath, 'utf-8').trim()
if (!raw) {
  console.error('Floorplan file is empty.')
  process.exit(1)
}

let payload: unknown
try {
  payload = JSON.parse(raw)
} catch (error) {
  console.error('Invalid JSON in floorplan file.')
  process.exit(1)
}

initDb()
run(
  `
  INSERT INTO floorplan_layout (id, data)
  VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
  `,
  [JSON.stringify(payload)]
)

console.log('Floorplan imported successfully.')
