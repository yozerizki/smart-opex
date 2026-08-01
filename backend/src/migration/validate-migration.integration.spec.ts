import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

describe('validate-migration script mismatch integration', () => {
  const originalEnv = process.env

  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = originalEnv
  })

  it('exits with code 1 and writes mismatch report', async () => {
    const reportPath = path.join(
      os.tmpdir(),
      `migration-validation-report-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    )

    class MockPgClient {
      async connect() {
        return undefined
      }

      async query() {
        return {
          rows: [{ count: 10 }],
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
          query: async () => ({ recordset: [{ count: 9 }] }),
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

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`EXIT_${code}`)
      }) as never)

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    process.env = {
      ...originalEnv,
      PG_SOURCE_URL: 'postgresql://user:pass@localhost:5432/smart_opex',
      MSSQL_TARGET_URL:
        'sqlserver://localhost:1433;database=smart_opex;user=sa;password=StrongPass123!',
      MIGRATION_VALIDATION_REPORT_PATH: reportPath,
    }

    const { run } = require('../../scripts/validate-migration')

    await expect(run()).rejects.toThrow('EXIT_1')
    expect(exitSpy).toHaveBeenCalledWith(1)

    const reportRaw = await fs.readFile(reportPath, 'utf8')
    const report = JSON.parse(reportRaw)

    expect(report.hasMismatch).toBe(true)
    expect(report.rows.length).toBe(12)
    expect(report.rows.every((row: any) => row.match === false)).toBe(true)

    errorSpy.mockRestore()
    exitSpy.mockRestore()
    await fs.unlink(reportPath)
  })
})
