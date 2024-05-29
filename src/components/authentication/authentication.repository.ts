import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, ServerException, Session } from '~/common';
import { DatabaseService, OnIndex } from '~/core/database';
import {
  ACTIVE,
  matchUserGloballyScopedRoles,
  requestingUser,
  variable,
} from '~/core/database/query';
import { ScopedRole } from '../authorization/dto';
import { LoginInput } from './dto';

interface EmailToken {
  email: string;
  token: string;
  createdOn: DateTime;
}

@Injectable()
export class AuthenticationRepository {
  constructor(private readonly db: DatabaseService) {}

  async waitForRootUserId() {
    let rootId: ID | undefined;
    await this.db.waitForConnection(
      {
        forever: true,
        maxTimeout: { seconds: 10 },
        unref: true,
      },
      async () => {
        // Ensure the root user exists, if not keep waiting
        rootId = await this.getRootUserId();
      },
    );
    return rootId!;
  }

  async getRootUserId() {
    const node = await this.db
      .query()
      .matchNode('node', 'RootUser')
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!node) {
      throw new ServerException('Could not find root user');
    }
    return node.id;
  }

  async saveSessionToken(token: string) {
    const result = await this.db
      .query()
      .raw(
        `
    CREATE
      (token:Token {
        active: true,
        createdAt: datetime(),
        value: $token
      })
    RETURN
      token.value as token
    `,
        {
          token,
        },
      )
      .first();
    if (!result) {
      throw new ServerException('Failed to save session token');
    }
  }

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await this.db
      .query()
      .match([
        node('user', 'User', {
          id: userId,
        }),
      ])
      .raw('', { passwordHash })
      .create([
        node('user'),
        relation('out', '', 'password', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('password', 'Property', {
          value: variable('$passwordHash'),
        }),
      ])
      .run();
  }

  async getPasswordHash(input: LoginInput) {
    const result = await this.db
      .query()
      .raw(
        `
    MATCH
      (:EmailAddress {value: $email})
      <-[:email {active: true}]-
      (user:User)
      -[:password {active: true}]->
      (password:Property)
    RETURN
      password.value as pash
    `,
        {
          email: input.email,
        },
      )
      .asResult<{ pash: string }>()
      .first();
    return result?.pash ?? null;
  }

  async connectSessionToUser(input: LoginInput, session: Session) {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {
            active: true,
            value: $token
          }),
          (:EmailAddress {value: $email})
          <-[:email {active: true}]-
          (user:User)
        OPTIONAL MATCH
          (token)-[r]-()
        DELETE r
        CREATE
          (user)-[:token {active: true, createdAt: datetime()}]->(token)
        RETURN
          user.id as id
      `,
        {
          token: session.token,
          email: input.email,
        },
      )
      .asResult<{ id: ID }>()
      .first();
    return result?.id;
  }

  async disconnectUserFromSession(token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {value: $token})-[r]-()
      DELETE
        r
      RETURN
        token.value as token
      `,
        {
          token,
        },
      )
      .run();
  }

  async resumeSession(token: string, impersonatee?: ID) {
    const result = await this.db
      .query()
      .raw('MATCH (token:Token { active: true, value: $token })', { token })
      .optionalMatch([
        node('token'),
        relation('in', '', 'token', ACTIVE),
        node('user', 'User'),
      ])
      .apply(matchUserGloballyScopedRoles('user', 'roles'))
      .apply(
        impersonatee
          ? (q) =>
              q.subQuery((sub) =>
                sub
                  .optionalMatch(
                    node('impersonatee', 'User', { id: impersonatee }),
                  )
                  .apply(
                    matchUserGloballyScopedRoles(
                      'impersonatee',
                      'impersonateeRoles',
                    ),
                  )
                  .return('impersonateeRoles'),
              )
          : null,
      )
      .return<{
        userId: ID | null;
        roles: readonly ScopedRole[];
        impersonateeRoles: readonly ScopedRole[] | null;
      }>([
        'user.id as userId',
        'roles',
        impersonatee ? 'impersonateeRoles' : '',
      ])
      .first();

    return result ?? null;
  }

  async rolesForUser(user: ID) {
    const result = await this.db
      .query()
      .matchNode('user', 'User', { id: user })
      .apply(matchUserGloballyScopedRoles('user', 'roles'))
      .return('roles')
      .first();
    return result?.roles ?? [];
  }

  async getCurrentPasswordHash(session: Session) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        relation('out', '', 'password', ACTIVE),
        node('password', 'Property'),
      ])
      .return('password.value as passwordHash')
      .asResult<{ passwordHash: string }>()
      .first();
    return result?.passwordHash ?? null;
  }

  async updatePassword(
    newPasswordHash: string,
    session: Session,
  ): Promise<void> {
    await this.db
      .query()
      .match([
        requestingUser(session),
        relation('out', '', 'password', ACTIVE),
        node('password', 'Property'),
      ])
      .setValues({
        'password.value': newPasswordHash,
      })
      .return('password.value as passwordHash')
      .first();
  }

  async doesEmailAddressExist(email: string) {
    const result = await this.db
      .query()
      .match([node('email', 'EmailAddress', { value: email })])
      .return('email')
      .first();
    return !!result;
  }

  async saveEmailToken(email: string, token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
      CREATE(et:EmailToken{value:$value, token: $token, createdOn:datetime()})
      RETURN et as emailToken
      `,
        {
          value: email,
          token,
        },
      )
      .run();
  }

  async findEmailToken(token: string) {
    const result = await this.db
      .query()
      .raw('MATCH (emailToken:EmailToken { token: $token })', { token })
      .return([
        'emailToken.value as email',
        'emailToken.token as token',
        'emailToken.createdOn as createdOn',
      ])
      .asResult<EmailToken>()
      .first();
    return result ?? null;
  }

  async updatePasswordViaEmailToken(
    { token, email }: EmailToken,
    pash: string,
  ): Promise<void> {
    await this.db
      .query()
      .raw(
        `
        MATCH (:EmailAddress {value: $email})<-[:email {active: true}]-(user:User)
        OPTIONAL MATCH (user)-[oldPasswordRel:password]->(oldPassword)
        SET oldPasswordRel.active = false
        WITH user
        LIMIT 1
        CREATE (user)-[:password {active: true, createdAt: $createdAt }]->(password:Property { value: $password })
        RETURN password
      `,
        {
          token,
          email,
          password: pash,
          createdAt: DateTime.local(),
        },
      )
      .first();
  }

  async removeAllEmailTokensForEmail(email: string) {
    await this.db
      .query()
      .match([node('emailToken', 'EmailToken', { value: email })])
      .delete('emailToken')
      .run();
  }

  async deactivateAllOtherSessions(session: Session) {
    await this.db
      .query()
      .match([
        requestingUser(session),
        relation('out', 'oldRel', 'token', ACTIVE),
        node('token', 'Token'),
      ])
      .raw('WHERE NOT token.value = $token', { token: session.token })
      .setValues({ 'oldRel.active': false })
      .run();
  }

  async deactivateAllOtherSessionsByEmail(email: string, session: Session) {
    await this.db
      .query()
      .match([
        node('emailAddress', 'EmailAddress', { value: email }),
        relation('in', '', 'email', ACTIVE),
        node('user', 'User'),
        relation('out', 'oldRel', 'token', ACTIVE),
        node('token', 'Token'),
      ])
      .raw('WHERE NOT token.value = $token', { token: session.token })
      .setValues({ 'oldRel.active': false })
      .run();
  }

  @OnIndex()
  private createIndexes() {
    return [
      `CREATE INDEX AuthToken_value IF NOT EXISTS FOR (n:Token) ON (n.value)`,
      `CREATE INDEX AuthEmailToken_token IF NOT EXISTS FOR (n:EmailToken) ON (n.token)`,
      `CREATE INDEX AuthEmailToken_email IF NOT EXISTS FOR (n:EmailToken) ON (n.value)`,
    ];
  }
}
