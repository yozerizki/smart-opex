import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { UserService } from '../user/user.service'
import { LdapService } from './ldap.service'

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private ldapService: LdapService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const authMode = this.configService.get<string>('AUTH_MODE') || 'local'
    const localAuthEmails = this.getLocalAuthEmails()

    if (authMode === 'ldap' && !this.isLocalAuthEmail(normalizedEmail, localAuthEmails)) {
      const ldapResult = await this.ldapService.authenticate(normalizedEmail, password)
      const existingUser = await this.userService.findByEmail(normalizedEmail)

      const user =
        existingUser ||
        (await this.userService.createUser({
          email: ldapResult.email,
          passwordHash: await bcrypt.hash(randomUUID(), 10),
          role: 'pic',
          district_id: null,
          area_id: null,
        }))

      return this.buildLoginResponse(user)
    }

    const user = await this.userService.findByEmail(normalizedEmail)

    if (!user) {
      throw new UnauthorizedException('Email tidak ditemukan')
    }

    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      throw new UnauthorizedException('Password salah')
    }

    return this.buildLoginResponse(user)
  }

  private buildLoginResponse(user: Awaited<ReturnType<UserService['findByEmail']>>) {
    if (!user) {
      throw new UnauthorizedException('Email tidak ditemukan')
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        district_id: user.district_id,
        area_id: user.area_id,
        district: user.districts,
        area: user.areas,
        profile: user.user_profiles,
      },
    }
  }

  private getLocalAuthEmails() {
    const rawValue = this.configService.get<string>('LOCAL_AUTH_EMAILS') || ''
    return new Set(
      rawValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )
  }

  private isLocalAuthEmail(email: string, localAuthEmails: Set<string>) {
    return localAuthEmails.has(email)
  }
}
