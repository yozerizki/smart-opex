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

async function run() {
  const pgSourceUrl = assertRequiredEnv('PG_SOURCE_URL')
  const mssqlTargetUrl = assertRequiredEnv('MSSQL_TARGET_URL')

  const pgClient = new PgClient({ connectionString: pgSourceUrl })
  const mssqlPool = new sql.ConnectionPool(mssqlTargetUrl)

  await pgClient.connect()
  await mssqlPool.connect()

  let hasMismatch = false

  try {
    for (const rawTableName of TABLES) {
      const tableName = escapeTableName(rawTableName)

      const pgCountResult = await pgClient.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`)
      const pgCount = Number(pgCountResult.rows[0]?.count || 0)

      const msCountResult = await mssqlPool.request().query(`SELECT COUNT(*) AS count FROM [${tableName}]`)
      const msCount = Number(msCountResult.recordset?.[0]?.count || 0)

      const status = pgCount === msCount ? 'OK' : 'MISMATCH'
      console.log(`${status} - ${tableName}: pg=${pgCount}, mssql=${msCount}`)

      if (pgCount !== msCount) {
        hasMismatch = true
      }
    }
  } finally {
    await pgClient.end()
    await mssqlPool.close()
  }

  if (hasMismatch) {
    console.error('Validation failed: row count mismatch found.')
    process.exit(1)
  }

  console.log('Validation passed: all row counts match.')
}

run().catch((error) => {
  console.error('Validation failed:', error)
  process.exit(1)
})