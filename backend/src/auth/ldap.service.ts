import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from 'ldapts'

interface LdapAuthenticationResult {
  email: string
  distinguishedName: string
}

@Injectable()
export class LdapService {
  constructor(private readonly configService: ConfigService) {}

  async authenticate(email: string, password: string): Promise<LdapAuthenticationResult> {
    const client = new Client({
      url: this.configService.getOrThrow<string>('LDAP_URL'),
      timeout: 10000,
      connectTimeout: 10000,
    })

    const baseDn = this.configService.getOrThrow<string>('LDAP_BASE_DN')
    const bindDn = this.configService.getOrThrow<string>('LDAP_BIND_DN')
    const bindPassword = this.configService.getOrThrow<string>('LDAP_BIND_PASSWORD')
    const escapedEmail = escapeLdapFilterValue(email)

    try {
      await client.bind(bindDn, bindPassword)

      const searchResult = await client.search(baseDn, {
        scope: 'sub',
        filter: `(userPrincipalName=${escapedEmail})`,
        attributes: ['distinguishedName', 'userPrincipalName'],
      })

      const entry = searchResult.searchEntries[0]
      if (!entry?.dn) {
        throw new UnauthorizedException('Email tidak ditemukan di LDAP')
      }

      await client.bind(entry.dn, password)

      return {
        email,
        distinguishedName: entry.dn,
      }
    } catch (error) {
      throw new UnauthorizedException('Email atau password LDAP salah')
    } finally {
      try {
        await client.unbind()
      } catch {
        // ignore unbind errors
      }
    }
  }
}

function escapeLdapFilterValue(value: string) {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00')
}