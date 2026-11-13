/** Writes the audit log: who changed what, old and new value, and the reason. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './current-user.decorator';

// Human-friendly role names for the audit trail
const ROLE_LABEL = { CUSTOMER: 'Customer', OPERATIONS: 'Operations', OPS_ADMIN: 'Ops admin', SUPER_ADMIN: 'Super admin' };

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Readable name of who did the action, e.g. "Super admin: Riya". */
  // Builds the "who did it" text stored with each audit entry
  actorLabel(u?: AuthUser): string {
    // No user = automatic/system action (e.g. webhook)
    if (!u) return 'System';
    // Customers show as "Customer", every staff role shows as "Admin"
    return `${u.role === 'CUSTOMER' ? 'Customer' : 'Admin'}: ${u.name} (${ROLE_LABEL[u.role]})`;
  }

  /** Writes one audit entry. Pass old and new values and a reason for overrides. */
  // Writes one audit row; called whenever an admin overrides or changes something important
  log(
    u: AuthUser | undefined,
    e: { area: string; action: string; target: string; oldValue?: string; newValue?: string; reason?: string },
  ) {
    return this.prisma.auditLog.create({
      // Stores the user id, readable label, and the area/action/target/old/new/reason fields
      data: { actorId: u?.id, actorLabel: this.actorLabel(u), ...e },
    });
  }
}
