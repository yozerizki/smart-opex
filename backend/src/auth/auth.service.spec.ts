import * as bcrypt from 'bcrypt'
import { AuthService } from './auth.service'

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

describe('AuthService', () => {
  const jwtSignMock = jest.fn(() => 'mock-jwt')
  const ldapAuthenticateMock = jest.fn()
  const findByEmailMock = jest.fn()
  const createUserMock = jest.fn()
  const configGetMock = jest.fn()

  const baseUser = {
    id: 10,
    email: 'user@example.com',
    password_hash: 'hashed-password',
    role: 'pic',
    district_id: null,
    area_id: null,
    districts: null,
    areas: null,
    user_profiles: null,
  }

  const buildService = () =>
    new AuthService(
      {
        findByEmail: findByEmailMock,
        createUser: createUserMock,
      } as any,
      {
        sign: jwtSignMock,
      } as any,
      {
        get: configGetMock,
      } as any,
      {
        authenticate: ldapAuthenticateMock,
      } as any,
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('auth local: login succeeds with email/password and does not call ldap', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'AUTH_MODE') return 'local'
      if (key === 'LOCAL_AUTH_EMAILS') return 'pusat@smartopex.local'
      return undefined
    })

    findByEmailMock.mockResolvedValue(baseUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

    const service = buildService()
    const result = await service.login('User@Example.com', 'password123')

    expect(ldapAuthenticateMock).not.toHaveBeenCalled()
    expect(findByEmailMock).toHaveBeenCalledWith('user@example.com')
    expect(result.access_token).toBe('mock-jwt')
    expect(result.user.role).toBe('pic')
  })

  it('auth ldap: existing user keeps old role and is not re-provisioned', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'AUTH_MODE') return 'ldap'
      if (key === 'LOCAL_AUTH_EMAILS') return 'pusat@smartopex.local'
      return undefined
    })

    const existingUser = {
      ...baseUser,
      email: 'd.agung@pertamina.com',
      role: 'verifikator',
      area_id: 12,
    }

    ldapAuthenticateMock.mockResolvedValue({
      email: 'd.agung@pertamina.com',
      distinguishedName: 'CN=d.agung,OU=Users,DC=pertamina,DC=com',
    })
    findByEmailMock.mockResolvedValue(existingUser)

    const service = buildService()
    const result = await service.login('d.agung@pertamina.com', 'ad-password')

    expect(ldapAuthenticateMock).toHaveBeenCalledWith('d.agung@pertamina.com', 'ad-password')
    expect(createUserMock).not.toHaveBeenCalled()
    expect(result.user.role).toBe('verifikator')
    expect(result.user.area_id).toBe(12)
  })

  it('auth ldap: new email gets auto-provisioned as pic', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'AUTH_MODE') return 'ldap'
      if (key === 'LOCAL_AUTH_EMAILS') return 'pusat@smartopex.local'
      return undefined
    })

    ldapAuthenticateMock.mockResolvedValue({
      email: 'new.user@pertamina.com',
      distinguishedName: 'CN=new.user,OU=Users,DC=pertamina,DC=com',
    })
    findByEmailMock.mockResolvedValue(null)
    createUserMock.mockResolvedValue({
      ...baseUser,
      id: 99,
      email: 'new.user@pertamina.com',
      role: 'pic',
    })

    ;(bcrypt.hash as jest.Mock).mockResolvedValueOnce('generated-hash')

    const service = buildService()
    const result = await service.login('new.user@pertamina.com', 'ad-password')

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@pertamina.com',
        role: 'pic',
        district_id: null,
        area_id: null,
      }),
    )
    expect(result.user.email).toBe('new.user@pertamina.com')
    expect(result.user.role).toBe('pic')
  })

  it('auth ldap: local-only seed email bypasses ldap and uses local password', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'AUTH_MODE') return 'ldap'
      if (key === 'LOCAL_AUTH_EMAILS') return 'pusat@smartopex.local'
      return undefined
    })

    const seedUser = {
      ...baseUser,
      email: 'pusat@smartopex.local',
      role: 'pusat',
    }
    findByEmailMock.mockResolvedValue(seedUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

    const service = buildService()
    const result = await service.login('pusat@smartopex.local', 'seed-password')

    expect(ldapAuthenticateMock).not.toHaveBeenCalled()
    expect(result.user.role).toBe('pusat')
  })
})
