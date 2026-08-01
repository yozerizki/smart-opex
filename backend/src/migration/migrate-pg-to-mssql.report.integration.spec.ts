import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

describe('migrate-pg-to-mssql script dry-run report integration', () => {
  const originalEnv = process.env

  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = originalEnv
  })

  it('writes dry-run report without destructive queries', async () => {
    const reportPath = path.join(
      os.tmpdir(),
      `migration-dry-run-report-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    )

    const mssqlQueries: string[] = []
    let pgSelectCount = 0

    class MockPgClient {
      async connect() {
        return undefined
      }

      async query() {
        pgSelectCount += 1
        return {
          rows: [{ id: pgSelectCount, code: `row-${pgSelectCount}` }],
        }
      }

      async end() {
        return undefined
      }
    }

    class MockMssqlPool {
      async connect() {
        return this
      }

      request() {
        return {
          query: async (sqlText: string) => {
            mssqlQueries.push(sqlText)
            return { recordset: [{ count: 0 }] }
          },
          input: () => undefined,
        }
      }

      async close() {
        return undefined
      }
    }

    jest.doMock('pg', () => ({
      Client: MockPgClient,
    }))

    jest.doMock('mssql', () => ({
      __esModule: true,
      default: {
        ConnectionPool: MockMssqlPool,
      },
    }))

    process.env = {
      ...originalEnv,
      PG_SOURCE_URL: 'postgresql://user:pass@localhost:5432/smart_opex',
      MSSQL_TARGET_URL:
        'sqlserver://localhost:1433;database=smart_opex;user=sa;password=StrongPass123!',
      MIGRATION_DRY_RUN: 'true',
      MIGRATION_TRUNCATE_BEFORE_LOAD: 'true',
      MIGRATION_ALLOW_DESTRUCTIVE: 'false',
      MIGRATION_REPORT_PATH: reportPath,
    }

    const { run } = require('../../scripts/migrate-pg-to-mssql')

    await run()

    const reportRaw = await fs.readFile(reportPath, 'utf8')
    const report = JSON.parse(reportRaw)

    expect(report.options.dryRun).toBe(true)
    expect(report.options.shouldTruncate).toBe(true)
    expect(report.rows.length).toBe(12)
    expect(report.rows.every((row: any) => row.mode === 'dry-run')).toBe(true)
    expect(mssqlQueries.some((query) => query.includes('DELETE FROM'))).toBe(false)
    expect(mssqlQueries.some((query) => query.includes('SET IDENTITY_INSERT'))).toBe(false)

    await fs.unlink(reportPath)
  })
})
