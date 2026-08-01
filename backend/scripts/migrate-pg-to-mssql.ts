import { Client as PgClient } from 'pg'
import sql from 'mssql'

const TABLES = [
  'group_views',
  'regions',
  'areas',
  'districts',
  'users',
  'user_profiles',
  'opex_projects',
  'opex_items',
  'documents',
  'ocr_results',
  'opex_receipts',
  'audit_logs',
] as const

const TABLES_WITH_IDENTITY = new Set<string>(TABLES)
const CHUNK_SIZE = Number(process.env.MIGRATION_CHUNK_SIZE || '200')

function assertRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`)
  }
  return value
}

function escapeTableName(name: string) {
  if (!/^[a-z_]+$/.test(name)) {
    throw new Error(`Unsafe table name: ${name}`)
  }
  return name
}

function normalizeValue(value: unknown) {
  if (value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && !(value instanceof Buffer)) {
    return JSON.stringify(value)
  }
  return value
}

async function insertChunk(
  pool: sql.ConnectionPool,
  tableName: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return

  const columns = Object.keys(rows[0])
  const request = pool.request()
  const valuesSql: string[] = []

  rows.forEach((row, rowIndex) => {
    const paramNames: string[] = []

    columns.forEach((columnName, columnIndex) => {
      const paramName = `p_${rowIndex}_${columnIndex}`
      paramNames.push(`@${paramName}`)
      request.input(paramName, normalizeValue(row[columnName]))
    })

    valuesSql.push(`(${paramNames.join(', ')})`)
  })

  const columnsSql = columns.map((column) => `[${column}]`).join(', ')
  const query = `INSERT INTO [${tableName}] (${columnsSql}) VALUES ${valuesSql.join(', ')}`

  await request.query(query)
}

async function run() {
  const pgSourceUrl = assertRequiredEnv('PG_SOURCE_URL')
  const mssqlTargetUrl = assertRequiredEnv('MSSQL_TARGET_URL')
  const shouldTruncate = (process.env.MIGRATION_TRUNCATE_BEFORE_LOAD || 'true').toLowerCase() !== 'false'

  const pgClient = new PgClient({ connectionString: pgSourceUrl })
  const mssqlPool = new sql.ConnectionPool(mssqlTargetUrl)

  await pgClient.connect()
  await mssqlPool.connect()

  try {
    for (const rawTableName of TABLES) {
      const tableName = escapeTableName(rawTableName)
      console.log(`Migrating table ${tableName}...`)

      const { rows } = await pgClient.query(`SELECT * FROM "${tableName}" ORDER BY id ASC`)

      if (shouldTruncate) {
        await mssqlPool.request().query(`DELETE FROM [${tableName}]`)
      }

      if (rows.length === 0) {
        console.log(`- ${tableName}: no rows`)
        continue
      }

      const useIdentityInsert = TABLES_WITH_IDENTITY.has(tableName)
      if (useIdentityInsert) {
        await mssqlPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`)
      }

      try {
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE)
          await insertChunk(mssqlPool, tableName, chunk)
        }
      } finally {
        if (useIdentityInsert) {
          await mssqlPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`)
        }
      }

      console.log(`- ${tableName}: ${rows.length} rows migrated`)
    }

    console.log('Migration completed successfully.')
  } finally {
    await pgClient.end()
    await mssqlPool.close()
  }
}

run().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})