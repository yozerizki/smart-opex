import { validateEnvironment } from './env.validation'

describe('validateEnvironment', () => {
  it('passes for local mode with JWT secret', () => {
    const env = {
      AUTH_MODE: 'local',
      JWT_SECRET: 'local-secret',
    }

    expect(validateEnvironment(env)).toEqual(env)
  })

  it('fails when AUTH_MODE is invalid', () => {
    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'hybrid',
        JWT_SECRET: 'secret',
      }),
    ).toThrow('AUTH_MODE must be local or ldap')
  })

  it('fails in ldap mode when required values are missing', () => {
    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'ldap',
        JWT_SECRET: 'secret',
      }),
    ).toThrow('LDAP_URL is required')
  })

  it('passes in ldap mode when all mandatory values are present', () => {
    const env = {
      AUTH_MODE: 'ldap',
      JWT_SECRET: 'prod-secret',
      LDAP_URL: 'ldaps://ad.pertamina.com:636',
      LDAP_BASE_DN: 'DC=pertamina,DC=com',
      LDAP_BIND_DN: 'CN=svc-smartopex,OU=Service Accounts,DC=pertamina,DC=com',
      LDAP_BIND_PASSWORD: 'bind-password',
      LOCAL_AUTH_EMAILS: 'pusat@smartopex.local',
    }

    expect(validateEnvironment(env)).toEqual(env)
  })
})