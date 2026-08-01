const allowedAuthModes = new Set(['local', 'ldap'])

function requireTrimmedValue(env: Record<string, string | undefined>, key: string, errors: string[]) {
  if (!env[key] || !env[key]?.trim()) {
    errors.push(`${key} is required`)
  }
}

export function validateEnvironment(env: Record<string, string | undefined>) {
  const errors: string[] = []
  const authMode = (env.AUTH_MODE || 'local').toLowerCase()

  if (!allowedAuthModes.has(authMode)) {
    errors.push('AUTH_MODE must be local or ldap')
  }

  requireTrimmedValue(env, 'JWT_SECRET', errors)

  if (authMode === 'ldap') {
    requireTrimmedValue(env, 'LDAP_URL', errors)
    requireTrimmedValue(env, 'LDAP_BASE_DN', errors)
    requireTrimmedValue(env, 'LDAP_BIND_DN', errors)
    requireTrimmedValue(env, 'LDAP_BIND_PASSWORD', errors)
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`)
  }

  return env
}