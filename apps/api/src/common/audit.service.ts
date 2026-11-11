/** Writes the audit log: who changed what, old and new value, and the reason. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './current-user.decorator';

const ROLE_LABEL = { CUSTOMER: 'Customer', OPERATIONS: 'Operations', OPS_ADMIN: 'Ops admin', SUPER_ADMIN: 'Super admin' };

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Readable name of who did the action, e.g. "Super admin: Riya". */
  actorLabel(u?: AuthUser): string {
    if (!u) return 'System';
    return `${u.role === 'CUSTOMER' ? 'Customer' : 'Admin'}: ${u.name} (${ROLE_LABEL[u.role]})`;
  }

  /** Writes one audit entry. Pass old and new values and a reason for overrides. */
  log(
    u: AuthUser | undefined,
    e: { area: string; action: string; target: string; oldValue?: string; newValue?: string; reason?: string },
  ) {
    return this.prisma.auditLog.create({
      data: { actorId: u?.id, actorLabel: this.actorLabel(u), ...e },
    });
  }
}
