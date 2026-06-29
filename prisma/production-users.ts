/**
 * prisma/production-users.ts — Real user provisioning
 *
 * Creates the initial set of real user accounts with
 * randomly generated temporary passwords. Each user is
 * forced to change their password on first login
 * (must_change_password = true), per the
 * "Pre-registered + First Login" auth model.
 *
 * ⚠️  Run this ONCE per environment. Re-running will only
 *     update existing users' dept/role, NOT regenerate
 *     passwords for users who already exist (to avoid
 *     locking out someone who already changed their password).
 *
 * Run:  npx tsx prisma/production-users.ts
 *
 * IMPORTANT: temporary passwords are printed to console
 * ONCE at creation time. Save them securely (e.g. share
 * via a password manager) — they are not stored in
 * plaintext anywhere, and not re-printable after this run.
 *
 * Requires: seed.ts to have run first (roles must exist).
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient({ log: ['error'] })

function generateTempPassword(): string {
  // 12-char random password: letters + digits,
  // avoiding ambiguous chars (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(
    { length: 12 },
    () => chars[crypto.randomInt(chars.length)]
  ).join('')
}

async function main() {
  const now = new Date()

  console.log('👤 Provisioning users…\n')

  const [roleAdmin, roleSL, rolePL, rolePacker] = await Promise.all([
    prisma.roles.findUniqueOrThrow({ where: { role_name: 'admin'  } }),
    prisma.roles.findUniqueOrThrow({ where: { role_name: 'sl'     } }),
    prisma.roles.findUniqueOrThrow({ where: { role_name: 'pl'     } }),
    prisma.roles.findUniqueOrThrow({ where: { role_name: 'packer' } }),
  ])

  // EDIT this list with real usernames/names/depts before running
  const usersSpec = [
    { username: 'admin_dow',  full_name: 'Admin User',  role: roleAdmin,  dept: 'all' },
    { username: 'sl_dow',     full_name: 'SL User',     role: roleSL,     dept: 'all' },
    { username: 'pl_dow',     full_name: 'PL User',     role: rolePL,     dept: 'PUF' },
    { username: 'packer_dow', full_name: 'Packer User', role: rolePacker, dept: 'PUF' },
  ]

  const createdCredentials: { username: string; tempPassword: string }[] = []

  for (const u of usersSpec) {
    const existing = await prisma.users.findUnique({
      where: { username: u.username },
    })

    if (existing) {
      // Update dept only — never touch password for an existing user
      await prisma.users.update({
        where: { username: u.username },
        data: { dept: u.dept, allowed_depts: u.dept, updated_at: now },
      })
      console.log(`  ↻ ${u.username} already exists — dept refreshed, password untouched`)
      continue
    }

    const tempPassword = generateTempPassword()
    const hash = await bcrypt.hash(tempPassword, 12)

    const created = await prisma.users.create({
      data: {
        username:             u.username,
        full_name:            u.full_name,
        password_hash:        hash,
        dept:                 u.dept,
        allowed_depts:        u.dept,
        last_active_role_id:  u.role.id,
        is_active:            true,
        must_change_password: true,
        created_at:           now,
        updated_at:           now,
      },
    })

    await prisma.user_roles.create({
      data: {
        user_id:    created.id,
        role_id:    u.role.id,
        granted_at: now,
      },
    })

    createdCredentials.push({ username: u.username, tempPassword })
    console.log(`  ✓ ${u.username} created`)
  }

  if (createdCredentials.length > 0) {
    const fs = await import('fs')
    const lines = createdCredentials.map(c => `${c.username.padEnd(12)} ${c.tempPassword}`)
    const outPath = './temp-credentials.local.txt'
    fs.writeFileSync(outPath, lines.join('\n') + '\n', { mode: 0o600 })
    console.log(`\n  ⚠️  Temporary credentials written to ${outPath}`)
    console.log('  Copy them now, then delete that file — it is not logged here for security.')
    console.log('  Each user must change password on first login.\n')
  } else {
    console.log('\n  No new users created — all usernames already existed.\n')
  }
}

main()
  .catch(e => { console.error('❌ User provisioning failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
