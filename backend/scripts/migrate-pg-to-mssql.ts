import { Client as PgClient } from 'pg'
import sql from 'mssql'
import * as fs from 'fs/promises'
import * as path from 'path'

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

interface MigrationRowReport {
  table: string
  sourceRows: number
  targetRowsBefore: number
  insertedRows: number
  truncatedBeforeLoad: boolean
  durationMs: number
  mode: 'dry-run' | 'apply'
}

function assertRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`)
  }
  return value
}

function toBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue
  return value.trim().toLowerCase() === 'true'
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
  const shouldTruncate = toBool(process.env.MIGRATION_TRUNCATE_BEFORE_LOAD, true)
  const dryRun = toBool(process.env.MIGRATION_DRY_RUN, false)
  const allowDestructive = toBool(process.env.MIGRATION_ALLOW_DESTRUCTIVE, false)
  const reportPath = process.env.MIGRATION_REPORT_PATH

  if (!dryRun && shouldTruncate && !allowDestructive) {
    throw new Error(
      'Refusing destructive load: set MIGRATION_ALLOW_DESTRUCTIVE=true or disable MIGRATION_TRUNCATE_BEFORE_LOAD',
    )
  }

  const pgClient = new PgClient({ connectionString: pgSourceUrl })
  const mssqlPool = new sql.ConnectionPool(mssqlTargetUrl)
  const reportRows: MigrationRowReport[] = []

  await pgClient.connect()
  await mssqlPool.connect()

  try {
    for (const rawTableName of TABLES) {
      const tableName = escapeTableName(rawTableName)
      const startedAt = Date.now()
      console.log(`Migrating table ${tableName}...`)

      const { rows } = await pgClient.query(`SELECT * FROM "${tableName}" ORDER BY id ASC`)
      const targetBeforeResult = await mssqlPool
        .request()
        .query(`SELECT COUNT(*) AS count FROM [${tableName}]`)
      const targetRowsBefore = Number(targetBeforeResult.recordset?.[0]?.count || 0)

      if (dryRun) {
        console.log(`- ${tableName}: dry-run source=${rows.length}, targetBefore=${targetRowsBefore}`)
        reportRows.push({
          table: tableName,
          sourceRows: rows.length,
          targetRowsBefore,
          insertedRows: 0,
          truncatedBeforeLoad: false,
          durationMs: Date.now() - startedAt,
          mode: 'dry-run',
        })
        continue
      }

      if (shouldTruncate) {
        await mssqlPool.request().query(`DELETE FROM [${tableName}]`)
      }

      if (rows.length === 0) {
        console.log(`- ${tableName}: no rows`)
        reportRows.push({
          table: tableName,
          sourceRows: 0,
          targetRowsBefore,
          insertedRows: 0,
          truncatedBeforeLoad: shouldTruncate,
          durationMs: Date.now() - startedAt,
          mode: 'apply',
        })
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
      reportRows.push({
        table: tableName,
        sourceRows: rows.length,
        targetRowsBefore,
        insertedRows: rows.length,
        truncatedBeforeLoad: shouldTruncate,
        durationMs: Date.now() - startedAt,
        mode: 'apply',
      })
    }

    console.log('Migration completed successfully.')

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
            options: {
              dryRun,
              shouldTruncate,
              allowDestructive,
              chunkSize: CHUNK_SIZE,
            },
            rows: reportRows,
          },
          null,
          2,
        ),
        'utf8',
      )
      console.log(`Migration report written to ${absolutePath}`)
    }
  } finally {
    await pgClient.end()
    await mssqlPool.close()
  }
}

run().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})