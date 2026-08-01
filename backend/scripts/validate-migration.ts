import { Client as PgClient } from 'pg'
import sql from 'mssql'
import * as fs from 'fs/promises'
import * as path from 'path'
import { parseMssqlTarget } from '../src/migration/migration-guards'

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

interface ValidationRowReport {
  table: string
  pgCount: number
  mssqlCount: number
  match: boolean
}

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
  const reportPath = process.env.MIGRATION_VALIDATION_REPORT_PATH

  const pgClient = new PgClient({ connectionString: pgSourceUrl })
  const mssqlPool = new sql.ConnectionPool(parseMssqlTarget(mssqlTargetUrl))

  await pgClient.connect()
  await mssqlPool.connect()

  let hasMismatch = false
  const rows: ValidationRowReport[] = []

  try {
    for (const rawTableName of TABLES) {
      const tableName = escapeTableName(rawTableName)

      const pgCountResult = await pgClient.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`)
      const pgCount = Number(pgCountResult.rows[0]?.count || 0)

      const msCountResult = await mssqlPool.request().query(`SELECT COUNT(*) AS count FROM [${tableName}]`)
      const msCount = Number(msCountResult.recordset?.[0]?.count || 0)

      const status = pgCount === msCount ? 'OK' : 'MISMATCH'
      console.log(`${status} - ${tableName}: pg=${pgCount}, mssql=${msCount}`)
      rows.push({
        table: tableName,
        pgCount,
        mssqlCount: msCount,
        match: pgCount === msCount,
      })

      if (pgCount !== msCount) {
        hasMismatch = true
      }
    }
  } finally {
    await pgClient.end()
    await mssqlPool.close()
  }

  if (reportPath) {
    const absolutePath = path.isAbsolute(reportPath)
      ? reportPath
      : path.join(process.cwd(), reportPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(
      absolutePath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          hasMismatch,
          rows,
        },
        null,
        2,
      ),
      'utf8',
    )
    console.log(`Validation report written to ${absolutePath}`)
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