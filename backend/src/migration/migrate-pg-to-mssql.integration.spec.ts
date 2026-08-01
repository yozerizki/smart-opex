import { spawnSync } from 'child_process'
import * as path from 'path'

describe('migrate-pg-to-mssql script integration guard', () => {
  it('fails fast when destructive load is not explicitly allowed', () => {
    const tsNodeBin = require.resolve('ts-node/dist/bin.js')
    const scriptPath = path.resolve(__dirname, '../../scripts/migrate-pg-to-mssql.ts')

    const result = spawnSync(process.execPath, [tsNodeBin, scriptPath], {
      env: {
        ...process.env,
        PG_SOURCE_URL: 'postgresql://user:pass@localhost:5432/smart_opex',
        MSSQL_TARGET_URL:
          'sqlserver://localhost:1433;database=smart_opex;user=sa;password=StrongPass123!',
        MIGRATION_DRY_RUN: 'false',
        MIGRATION_TRUNCATE_BEFORE_LOAD: 'true',
        MIGRATION_ALLOW_DESTRUCTIVE: 'false',
      },
      encoding: 'utf8',
    })

    const combinedOutput = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(1)
    expect(combinedOutput).toContain('Refusing destructive load')
  })
})
