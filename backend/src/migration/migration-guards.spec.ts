import {
  parseMssqlTarget,
  shouldRefuseDestructiveLoad,
  toBool,
} from './migration-guards'

describe('migration-guards', () => {
  describe('toBool', () => {
    it('returns default when value is undefined', () => {
      expect(toBool(undefined, true)).toBe(true)
      expect(toBool(undefined, false)).toBe(false)
    })

    it('parses true and false values case-insensitively', () => {
      expect(toBool('true', false)).toBe(true)
      expect(toBool('TRUE', false)).toBe(true)
      expect(toBool('false', true)).toBe(false)
      expect(toBool('FALSE', true)).toBe(false)
    })
  })

  describe('parseMssqlTarget', () => {
    it('keeps non-sqlserver URL as raw string', () => {
      const url = 'mssql://sa:Password123@localhost:1433/smartopex?encrypt=true'
      expect(parseMssqlTarget(url)).toBe(url)
    })

    it('parses prisma-style sqlserver URL into config object', () => {
      const parsed = parseMssqlTarget(
        'sqlserver://dbhost:1444;database=smartopex;user=sa;password=Secret1;encrypt=true;trustServerCertificate=true',
      ) as any

      expect(parsed.server).toBe('dbhost')
      expect(parsed.port).toBe(1444)
      expect(parsed.user).toBe('sa')
      expect(parsed.password).toBe('Secret1')
      expect(parsed.database).toBe('smartopex')
      expect(parsed.options.encrypt).toBe(true)
      expect(parsed.options.trustServerCertificate).toBe(true)
    })

    it('throws when required sqlserver URL parts are missing', () => {
      expect(() => parseMssqlTarget('sqlserver://dbhost:1433;database=smartopex')).toThrow(
        'MSSQL_TARGET_URL sqlserver format requires server host, user, password, and database',
      )
    })
  })

  describe('shouldRefuseDestructiveLoad', () => {
    it('refuses truncate when not dry-run and destructive flag is off', () => {
      expect(
        shouldRefuseDestructiveLoad({
          dryRun: false,
          shouldTruncate: true,
          allowDestructive: false,
        }),
      ).toBe(true)
    })

    it('allows run when dry-run is enabled', () => {
      expect(
        shouldRefuseDestructiveLoad({
          dryRun: true,
          shouldTruncate: true,
          allowDestructive: false,
        }),
      ).toBe(false)
    })

    it('allows run when truncate is disabled', () => {
      expect(
        shouldRefuseDestructiveLoad({
          dryRun: false,
          shouldTruncate: false,
          allowDestructive: false,
        }),
      ).toBe(false)
    })

    it('allows run when destructive flag is enabled', () => {
      expect(
        shouldRefuseDestructiveLoad({
          dryRun: false,
          shouldTruncate: true,
          allowDestructive: true,
        }),
      ).toBe(false)
    })
  })
})
