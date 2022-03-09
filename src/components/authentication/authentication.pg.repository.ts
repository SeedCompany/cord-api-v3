import { Injectable } from '@nestjs/common';
import { ID, PublicOf, ServerException, Session } from '../../common';
import { Pg } from '../../core';
import { ScopedRole } from '../authorization';
import {
  AuthenticationRepository,
  EmailToken,
} from './authentication.repository';
import { LoginInput } from './dto';

@Injectable()
export class PgAuthenticationRepository
  implements PublicOf<AuthenticationRepository>
{
  constructor(private readonly pg: Pg) {}

  async resumeSession(
    token: string
  ): Promise<{ userId?: ID; roles: ScopedRole[] } | undefined> {
    const [{ userId }] = await this.pg.query<{ userId: ID }>(
      'SELECT person as "userId" FROM admin.tokens WHERE token = $1',
      [token]
    );

    if (!userId) {
      throw new Error('Could not find user');
    }

    const [{ roles }] = await this.pg.query<{ roles: string[] }>(
      `
      SELECT array_agg(r.name) as roles
      FROM admin.role_memberships rm, admin.roles r
      WHERE rm.person = $1 AND r.id = rm.role
      GROUP BY rm.person
      `,
      [userId]
    );

    return {
      userId: userId,
      roles: roles as unknown as ScopedRole[],
    };
  }

  async saveSessionToken(token: string, userId?: ID) {
    const rows = await this.pg.query<{ token: string }>(
      'INSERT INTO admin.tokens (token, person) VALUES ($1, $2) RETURNING token;',
      [token, userId]
    );

    if (!rows[0].token) {
      throw new ServerException('Failed to save session token');
    }
  }

  async findSessionToken(
    token: string
  ): Promise<{ token: string; userId?: ID | undefined } | undefined> {
    const rows = await this.pg.query<{ token: string; userId: ID }>(
      'SELECT person as userId, token FROM admin.tokens WHERE token = $1;',
      [token]
    );

    return rows[0];
  }

  async saveEmailToken(email: string, token: string) {
    const rows = await this.pg.query<{ token: string }>(
      `
      INSERT INTO admin.email_tokens (token, user_id) VALUES ($1, (SELECT id FROM admin.users WHERE email = $2))
      RETURNING token;
      `,
      [token, email]
    );

    if (!rows[0].token) {
      throw new ServerException('Failed to save email token');
    }
  }

  async findEmailToken(token: string): Promise<EmailToken | undefined> {
    const rows = await this.pg.query<EmailToken>(
      `
      SELECT u.email, e.token, e.created_at as "createdOn" FROM admin.email_tokens as e, admin.users as u
      WHERE e.token = $1 AND e.user_id = u.id;
      `,
      [token]
    );
    return rows[0];
  }

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await this.pg.query('UPDATE admin.users SET password = $1 WHERE id = $2;', [
      passwordHash,
      userId,
    ]);
  }

  async getPasswordHash(input: LoginInput, session: Session) {
    const rows = await this.pg.query<{ pash: string }>(
      `
      SELECT u.password as pash FROM admin.users as u, admin.tokens as t 
      WHERE u.email = $1 AND t.token = $2 AND t.person = u.id;
      `,
      [input.email, session.token]
    );

    return rows[0].pash;
  }

  async getCurrentPasswordHash(session: Session): Promise<string | undefined> {
    const rows = await this.pg.query<{ pash: string }>(
      'SELECT password as pash FROM admin.users WHERE id = (SELECT person FROM admin.tokens WHERE token = $1);',
      [session.token]
    );

    return rows[0].pash;
  }

  async doesEmailAddressExist(email: string): Promise<boolean> {
    const rows = await this.pg.query(
      'SELECT email FROM admin.users WHERE email = $1;',
      [email]
    );

    return !!rows[0];
  }

  async deleteSessionToken(token: string): Promise<void> {
    await this.pg.query('DELETE FROM admin.tokens WHERE token = $1;', [token]);
  }

  async updatePassword(
    newPasswordHash: string,
    session: Session
  ): Promise<void> {
    await this.pg.query('UPDATE admin.users SET password = $1 WHERE id = $2;', [
      newPasswordHash,
      session.userId,
    ]);
  }

  async updatePasswordViaEmailToken(
    { token, email }: EmailToken,
    pash: string
  ): Promise<void> {
    await this.pg.query(
      `
      UPDATE admin.users SET password = $1 
      WHERE id = (
                    SELECT t.user_id FROM admin.email_tokens as t, admin.users as u
                    WHERE t.token = $2 AND u.email = $3 AND t.user_id = u.id
                 );
      `,
      [pash, token, email]
    );
  }

  async getUserFromSession(session: Session) {
    const rows = await this.pg.query<{ person: ID }>(
      'SELECT person FROM admin.tokens WHERE token = $1;',
      [session.token]
    );
    return rows[0].person;
  }

  async connectSessionToUser(
    input: LoginInput,
    session: Session
  ): Promise<ID | undefined> {
    const rows = await this.pg.query<{ id: ID }>(
      'SELECT id FROM admin.users WHERE email = $1;',
      [input.email]
    );

    if (!rows[0].id) {
      throw new ServerException('Could not find user');
    }

    await this.saveSessionToken(session.token, rows[0].id);
    return rows[0].id;
  }

  async removeAllEmailTokensForEmail(email: string): Promise<void> {
    await this.pg.query(
      `
      DELETE FROM admin.email_tokens 
      WHERE user_id = (SELECT id FROM admin.users WHERE email = $1);
      `,
      [email]
    );
  }

  deactivateAllOtherSessions(_session: Session): Promise<void> {
    throw new Error('Method not implemented.');
  }

  deactivateAllOtherSessionsByEmail(
    _email: string,
    _session: Session
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
