/**
 * Healthy Pots admin CLI (works on Windows, macOS and Linux; no bash needed).
 *
 *   npm run cli -- help
 *   npm run cli -- create-staff --email a@b.com --name "Asha" --role OPS_ADMIN --password "Str0ng!Pass"
 *   npm run cli -- reset-password --email a@b.com --password "New!Pass123"
 *   npm run cli -- set-active --email a@b.com --active false
 *   npm run cli -- list-users [--role SUPER_ADMIN]
 *   npm run cli -- stats
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const STAFF: Role[] = ['SUPER_ADMIN', 'OPS_ADMIN', 'OPERATIONS'];

function args(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      out[key] = next && !next.startsWith('--') ? (i++, next) : 'true';
    }
  }
  return out;
}
const fail = (m: string): never => { console.error(`Error: ${m}`); process.exit(1); };
const need = (a: Record<string, string>, k: string) => a[k] || fail(`--${k} is required`);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_OK = (p: string) => p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  switch (cmd) {
    case 'create-staff': {
      const email = need(a, 'email').toLowerCase();
      const name = need(a, 'name');
      const role = need(a, 'role') as Role;
      const password = need(a, 'password');
      if (!EMAIL_RE.test(email)) fail('invalid email');
      if (!STAFF.includes(role)) fail(`role must be one of ${STAFF.join(', ')}`);
      if (!PASSWORD_OK(password)) fail('password needs 10+ characters with upper case, lower case and a digit');
      const u = await prisma.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) } });
      console.log(`Created ${role} ${u.email}`);
      break;
    }
    case 'reset-password': {
      const email = need(a, 'email').toLowerCase();
      const password = need(a, 'password');
      if (!PASSWORD_OK(password)) fail('password needs 10+ characters with upper case, lower case and a digit');
      const u = await prisma.user.findUnique({ where: { email } });
      if (!u || u.role === 'CUSTOMER') fail('no staff user with that email');
      await prisma.user.update({ where: { email }, data: { passwordHash: await bcrypt.hash(password, 10) } });
      console.log(`Password updated for ${email}`);
      break;
    }
    case 'set-active': {
      const email = need(a, 'email').toLowerCase();
      const active = need(a, 'active') === 'true';
      await prisma.user.update({ where: { email }, data: { active } });
      console.log(`${email} is now ${active ? 'active' : 'disabled'}`);
      break;
    }
    case 'list-users': {
      const role = a.role as Role | undefined;
      const users = await prisma.user.findMany({ where: role ? { role } : { role: { in: STAFF } }, orderBy: { createdAt: 'asc' } });
      console.table(users.map((u) => ({ email: u.email ?? u.phone, name: u.name, role: u.role, active: u.active })));
      break;
    }
    case 'stats': {
      const [customers, active, meals, open] = await Promise.all([
        prisma.customer.count(),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.meal.count(),
        prisma.deliveryException.count({ where: { status: 'OPEN' } }),
      ]);
      console.table({ customers, activeSubscriptions: active, meals, openDeliveryExceptions: open });
      break;
    }
    default:
      console.log('Commands: create-staff, reset-password, set-active, list-users, stats\nSee the header of apps/api/scripts/cli.ts for examples.');
  }
}

main().catch((e) => { console.error(e.code === 'P2002' ? 'Error: that email already exists' : e.message); process.exit(1); }).finally(() => prisma.$disconnect());
