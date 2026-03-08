import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import initSqlJs from 'sql.js'
import { createRequire } from 'module'

dotenv.config()

const require = createRequire(import.meta.url)
const dbPath = process.env.SQLITE_PATH ?? './data/app.db'
const resolvedPath = path.resolve(dbPath)
const dir = path.dirname(resolvedPath)

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
const SQL = await initSqlJs({
  locateFile: () => wasmPath
})

const dbFile = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath) : null
const db = new SQL.Database(dbFile ? new Uint8Array(dbFile) : undefined)

db.exec('PRAGMA journal_mode=WAL;')
db.exec('PRAGMA foreign_keys=ON;')

function persist() {
  const data = db.export()
  fs.writeFileSync(resolvedPath, Buffer.from(data))
}

export function getDbPath() {
  return resolvedPath
}

export function exec(sql: string) {
  db.exec(sql)
  persist()
}

export function run(sql: string, params: unknown[] = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  stmt.step()
  stmt.free()
  const changes = db.getRowsModified()
  const lastRow = db.exec('SELECT last_insert_rowid() AS id')
  const lastInsertRowid = lastRow?.[0]?.values?.[0]?.[0] ?? null
  persist()
  return { changes, lastInsertRowid }
}

export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const hasRow = stmt.step()
  const row = hasRow ? (stmt.getAsObject() as T) : undefined
  stmt.free()
  return row
}

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function transaction<T>(fn: () => T) {
  try {
    db.exec('BEGIN;')
    const result = fn()
    db.exec('COMMIT;')
    persist()
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK;')
    } catch (rollbackError) {
      console.error('[db] rollback failed', rollbackError)
    }
    throw error
  }
}

function columnExists(table: string, column: string) {
  const result = db.exec(`PRAGMA table_info(${table});`)
  if (!result[0]?.values) return false
  return result[0].values.some((row) => String(row[1]) === column)
}

function addColumnIfMissing(table: string, definition: string) {
  const columnName = definition.split(/\s+/)[0]
  if (columnExists(table, columnName)) return
  const safeDefinition = definition.replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP/i, '')
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${safeDefinition};`)
}

export function initDb() {
  exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfid_uid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT,
      product TEXT,
      department_id INTEGER REFERENCES departments(id),
      product_id INTEGER REFERENCES products(id),
      points INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      work_duration INTEGER,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'clocked_in',
      notes TEXT,
      signature_data TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfid_uid TEXT NOT NULL,
      scan_time TEXT DEFAULT CURRENT_TIMESTAMP,
      action TEXT,
      success INTEGER,
      message TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS floorplan_layout (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

  `)

  addColumnIfMissing('users', 'department_id INTEGER REFERENCES departments(id)')
  addColumnIfMissing('users', 'product_id INTEGER REFERENCES products(id)')
  addColumnIfMissing('users', 'updated_at TEXT')
  addColumnIfMissing('attendance', 'updated_at TEXT')
  addColumnIfMissing('scan_log', 'updated_at TEXT')
  addColumnIfMissing('departments', 'updated_at TEXT')
  addColumnIfMissing('products', 'updated_at TEXT')

  exec(`
    CREATE TRIGGER IF NOT EXISTS users_updated_at
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS attendance_updated_at
    AFTER UPDATE ON attendance
    BEGIN
      UPDATE attendance SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS departments_updated_at
    AFTER UPDATE ON departments
    BEGIN
      UPDATE departments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS products_updated_at
    AFTER UPDATE ON products
    BEGIN
      UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `)

  run("UPDATE users SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)")
  run("UPDATE attendance SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)")
  run("UPDATE scan_log SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)")
  run("UPDATE departments SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)")
  run("UPDATE products SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)")

  exec(`
    CREATE INDEX IF NOT EXISTS idx_users_rfid ON users(rfid_uid);
    CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
    CREATE INDEX IF NOT EXISTS idx_users_product_id ON users(product_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_scan_log_rfid_time ON scan_log(rfid_uid, scan_time);
  `)

  const seedUsers = [
    ['8144EE19', 'Jamey Lee Stone', 'john.doe@company.com', 'WMO'],
    ['11F3EF12', 'Derk Ottersberg', 'jane.smith@company.com', 'Marketing'],
    ['53C991A6', 'Bob Wilson', 'bob.wilson@company.com', 'Engineering'],
    ['12A7F9B1', 'Silas', 'silas@company.com', 'Engineering'],
    ['14C2E8F5', 'Vincent', 'vincent@company.com', 'Engineering'],
    ['15B6A1E3', 'Tobias', 'tobias@company.com', 'IT'],
    ['16D9E2C7', 'Karkau', 'karkau@company.com', 'IT'],
    ['17F4B3A2', 'Bryan', 'bryan@company.com', 'Sales'],
    ['18E1C4D9', 'Bas', 'bas@company.com', 'Finance'],
    ['19A5E6F8', 'Lisa', 'lisa@company.com', 'HR'],
    ['20C7B2D1', 'Melvin', 'melvin@company.com', 'Engineering'],
    ['21D8E3F9', 'Michael', 'michael@company.com', 'IT'],
    ['22A9C4B5', 'Niek', 'niek@company.com', 'Engineering'],
    ['23B7E5D3', 'Patrick', 'patrick@company.com', 'Marketing'],
    ['24F2A8E6', 'Martin', 'martin@company.com', 'Operations'],
    ['25E6D7B1', 'Bryan Brugman', 'bryan.brugman@company.com', 'Sales'],
    ['26A4C9E3', 'Patrick Houtsma', 'patrick.houtsma@company.com', 'Engineering'],
    ['27B5F8A2', 'Sebastien', 'sebastien@company.com', 'Design'],
    ['28D3C6E9', 'Elwin L', 'elwin.l@company.com', 'IT'],
    ['29E9F7C4', 'Melvin Z', 'melvin.z@company.com', 'Engineering'],
    ['30C1A2B5', 'Gerrit', 'gerrit@company.com', 'Engineering'],
    ['31F8E2D7', 'George', 'george@company.com', 'Engineering'],
    ['32D6A5F3', 'Marijn', 'marijn@company.com', 'Marketing'],
    ['33A7C8E2', 'Nikki', 'nikki@company.com', 'HR'],
    ['34B9D5F1', 'Roel', 'roel@company.com', 'Engineering'],
    ['35E2C4A8', 'Rowin', 'rowin@company.com', 'IT'],
    ['36F7D9E5', 'Jaimy', 'jaimy@company.com', 'Engineering'],
    ['37A1B6C9', 'Niels', 'niels@company.com', 'Finance'],
    ['38E5D2F3', 'Alwin', 'alwin@company.com', 'IT'],
    ['39B8C7D4', 'Jordy Jongmans', 'jordy.jongmans@company.com', 'Engineering'],
    ['40C9A5E1', 'Yorick', 'yorick@company.com', 'Marketing'],
    ['41D2B8F6', 'Jelle', 'jelle@company.com', 'Engineering']
  ]

  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (rfid_uid, name, email, department) VALUES (?, ?, ?, ?)'
  )

  db.exec('BEGIN;')
  for (const user of seedUsers) {
    insertUser.run(user)
  }
  db.exec('COMMIT;')
  insertUser.free()

  run('INSERT OR IGNORE INTO floorplan_layout (id, data) VALUES (1, ?)', ['{}'])

  run('INSERT OR IGNORE INTO departments (name) SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department <> \'\'')
  run('INSERT OR IGNORE INTO products (name) SELECT DISTINCT product FROM users WHERE product IS NOT NULL AND product <> \'\'')
  run('UPDATE users SET department_id = (SELECT id FROM departments WHERE name = users.department) WHERE department IS NOT NULL')
  run('UPDATE users SET product_id = (SELECT id FROM products WHERE name = users.product) WHERE product IS NOT NULL')
}
