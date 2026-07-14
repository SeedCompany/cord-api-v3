import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ID } from '~/common';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import { userGlobalRoles, users } from '~/core/drizzle/schema';
import { type PersonaRole } from './types';

/**
 * Personas are DETERMINISTIC: for each role, the live user with the lowest id
 * holding that global role. Resolved from Postgres in BOTH capture runs (both
 * runs set POSTGRES_URL), so the same user ids resolve for each engine — the
 * diff asserts this via the capture meta.
 */
export const PERSONA_ROLES: readonly PersonaRole[] = [
  'Administrator',
  'ProjectManager',
  'Consultant',
  'Intern',
  'FieldPartner',
  'Marketing',
  'StaffMember',
];

export interface ResolvedPersonas {
  readonly personas: ReadonlyMap<PersonaRole, ID<'User'>>;
  readonly skipped: readonly PersonaRole[];
}

export const resolvePersonas = async (
  db: DrizzleDb,
  log: (msg: string) => void,
): Promise<ResolvedPersonas> => {
  const personas = new Map<PersonaRole, ID<'User'>>();
  const skipped: PersonaRole[] = [];
  for (const role of PERSONA_ROLES) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userGlobalRoles, eq(userGlobalRoles.userId, users.id))
      .where(and(eq(userGlobalRoles.role, role), isNull(users.deletedAt)))
      .orderBy(asc(users.id))
      .limit(1);
    const row = rows[0];
    if (row) {
      personas.set(role, row.id);
    } else {
      skipped.push(role);
      log(`  persona ${role}: no live user holds this role — skipping`);
    }
  }
  return { personas, skipped };
};
