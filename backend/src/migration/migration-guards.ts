import sql from 'mssql'

export function toBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue
  return value.trim().toLowerCase() === 'true'
}

export function parseMssqlTarget(target: string): string | sql.config {
  if (!target.startsWith('sqlserver://')) {
    return target
  }

  const body = target.replace(/^sqlserver:\/\//, '')
  const sections = body.split(';').map((section) => section.trim()).filter(Boolean)
  const [serverSection, ...optionSections] = sections
  const [serverHost, serverPortRaw] = serverSection.split(':')

  const optionsMap = new Map<string, string>()
  for (const section of optionSections) {
    const eqIndex = section.indexOf('=')
    if (eqIndex <= 0) continue
    const key = section.slice(0, eqIndex).trim().toLowerCase()
    const value = section.slice(eqIndex + 1).trim()
    optionsMap.set(key, value)
  }

  const user = optionsMap.get('user') || optionsMap.get('uid')
  const password = optionsMap.get('password') || optionsMap.get('pwd')
  const database = optionsMap.get('database')

  if (!serverHost || !user || !password || !database) {
    throw new Error(
      'MSSQL_TARGET_URL sqlserver format requires server host, user, password, and database',
    )
  }

  const encrypt = (optionsMap.get('encrypt') || 'true').toLowerCase() === 'true'
  const trustServerCertificate =
    (optionsMap.get('trustservercertificate') || 'false').toLowerCase() === 'true'

  return {
    server: serverHost,
    port: serverPortRaw ? Number(serverPortRaw) : 1433,
    user,
    password,
    database,
    options: {
      encrypt,
      trustServerCertificate,
    },
  }
}

export function shouldRefuseDestructiveLoad(options: {
  dryRun: boolean
  shouldTruncate: boolean
  allowDestructive: boolean
}) {
  return !options.dryRun && options.shouldTruncate && !options.allowDestructive
}