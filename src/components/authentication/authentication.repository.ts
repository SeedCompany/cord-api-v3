import { Injectable } from '@nestjs/common';
import { node, not, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, ServerException, Session } from '../../common';
import { DatabaseService, matchRequestingUser } from '../../core';
import { PostgresService } from '../../core/postgres/postgres.service';
import { ACTIVE } from '../../core/database/query';
import { LoginInput } from './dto';
import { PutObjectLegalHoldRequest } from '@aws-sdk/client-s3';

interface EmailToken {
  email: string;
  token: string;
  createdOn: DateTime;
}

@Injectable()
export class AuthenticationRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly pg: PostgresService
  ) {}

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
        }
      )
      .first();
    const pool = PostgresService.pool;
    const pgResult = await pool.query(
      `call public.create(0,'public.tokens', $1, 0,0,0,0,0)`,
      [
        PostgresService.convertObjectToHstore({
          token,
          // person: id
        }),
      ]
    );
    console.log('saveSessionToken', pgResult.rows[0].record_id);
    if (!result) {
      throw new ServerException('Failed to save session token');
    }
  }

  async getUserFromSession(session: Session) {
    const userRes = await this.db
      .query()
      .match([
        node('token', 'Token', {
          active: true,
          value: session.token,
        }),
        relation('in', '', 'token', {
          active: true,
        }),
        node('user', 'User'),
      ])
      .return({ user: [{ id: 'id' }] })
      .asResult<{ id: ID }>()
      .first();
    const pool = await PostgresService.pool;
    const pgResult = await pool.query(
      `select p.neo4j_id from public.tokens t inner join public.people_data p on t.person = p.id where t.token = $1`,
      [session.token]
    );
    console.log('getUserFromSession', {
      pg: pgResult.rows[0].neo4j_id,
      neo4j: userRes?.id,
    });
    return pgResult.rows[0].neo4j_id;
    // return userRes?.id;
  }

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await this.db
      .query()
      .match([
        node('user', 'User', {
          id: userId,
        }),
      ])
      .create([
        node('user'),
        relation('out', '', 'password', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('password', 'Property', {
          value: passwordHash,
        }),
      ])
      .run();
    const pool = PostgresService.pool;
    const pgUserRow = await pool.query(
      `select id from public.people_data where neo4j_id = $1`,
      [userId]
    );
    const pgUserId = pgUserRow.rows[0].id;
    await pool.query(`call public.update(0,$1, 'public.users_data', $2, 0,0)`, [
      pgUserId,
      PostgresService.convertObjectToHstore({
        password: passwordHash,
      }),
    ]);
    console.log('savePasswordHashOnUser', pgUserId);
  }

  async getPasswordHash(input: LoginInput, session: Session) {
    const result = await this.db
      .query()
      .raw(
        `
    MATCH
      (token:Token {
        active: true,
        value: $token
      })
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
          token: session.token,
          email: input.email,
        }
      )
      .asResult<{ pash: string }>()
      .first();
    const pool = PostgresService.pool;
    const pgResult = await pool.query(
      `select u.password from public.users_data u where email = $1`,
      [input.email]
    );
    // return pgResult.rows[0]?.password;
    console.log('getPasswordHash', {
      pg: pgResult.rows[0]?.password,
      neo4j: result?.pash,
    });
    return result?.pash;
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
        }
      )
      .asResult<{ id: ID }>()
      .first();
    const pool = PostgresService.pool;
    // const tokenRow = await pool.query(`select token from `);
    const personRow = await pool.query(
      `select p.id, p.neo4j_id from public.users_data u inner join public.people_data p on p.id = u.person where u.email = $1`,
      [input.email]
    );
    const tokenRow = await pool.query(
      `select t.id from public.tokens t where token = $1`,
      [session.token]
    );
    console.log('connectSessionToUser', {
      tokenId: tokenRow.rows[0]?.id,
      person: personRow.rows[0]?.id,
    });
    if (tokenRow.rows[0]?.id) {
      await pool.query(`call public.update(0, $1,'public.tokens', $2, 0,0 )`, [
        tokenRow.rows[0]?.id,
        PostgresService.convertObjectToHstore({
          person: personRow.rows[0]?.id,
        }),
      ]);
    } else {
      await pool.query(
        `call public.create(0, 'public.tokens', $1, 0,0,0,0,0 )`,
        [
          PostgresService.convertObjectToHstore({
            token: session.token,
            person: personRow.rows[0]?.id,
          }),
        ]
      );
    }
    console.log(
      'connectSessionToUser',
      result?.id,
      personRow.rows[0]?.neo4j_id
    );
    return personRow.rows[0]?.neo4j_id;
  }

  async deleteSessionToken(token: string): Promise<void> {
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
        }
      )
      .run();
    const pool = PostgresService.pool;
    await pool.query(`delete from public.tokens where token = $1`, [token]);
    console.log('deleteSessionToken');
  }

  async findSessionToken(token: string) {
    const result = await this.db
      .query()
      .match([
        node('token', 'Token', {
          active: true,
          value: token,
        }),
      ])
      .optionalMatch([
        node('token'),
        relation('in', '', 'token', ACTIVE),
        node('user', 'User'),
      ])
      .return('token, user.id AS userId')
      .asResult<{ token: string; userId?: ID }>()
      .first();
    // POSTGRES
    const pool = PostgresService.pool;
    const tokenRow = await pool.query(
      `select token,person from public.tokens where token = $1`,
      [token]
    );
    let personNeo4jId: ID | undefined;
    const personRow = await pool.query(
      `select neo4j_id from public.people_data where id = $1`,
      [tokenRow.rows[0]?.person]
    );
    personNeo4jId = personRow.rows[0]?.neo4j_id;
    const postgresResult = { token, userId: personNeo4jId };
    console.log('findSessionToken', { pg: postgresResult, neo4j: result });

    return postgresResult;
  }

  async getCurrentPasswordHash(session: Session) {
    const result = await this.db
      .query()
      .match([
        node('requestingUser', 'User', { id: session.userId }),
        relation('out', '', 'password', ACTIVE),
        node('password', 'Property'),
      ])
      .return('password.value as passwordHash')
      .asResult<{ passwordHash: string }>()
      .first();
    const pool = PostgresService.pool;
    const pgResult = await pool.query(
      `select u.password from public.users_data u inner join public.people_data p on p.id = u.person where p.neo4j_id = $1`,
      [session.userId]
    );
    console.log('getCurrentPasswordHash', {
      pg: pgResult.rows[0].password,
      neo4j: result?.passwordHash,
    });
    return result?.passwordHash;
  }

  async updatePassword(
    newPasswordHash: string,
    session: Session
  ): Promise<void> {
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('requestingUser'),
        relation('out', '', 'password', ACTIVE),
        node('password', 'Property'),
      ])
      .setValues({
        'password.value': newPasswordHash,
      })
      .return('password.value as passwordHash')
      .first();
    console.log('updatePassword');
  }

  async doesEmailAddressExist(email: string) {
    const result = await this.db
      .query()
      .match([node('email', 'EmailAddress', { value: email })])
      .return('email')
      .first();
    const pool = PostgresService.pool;
    const pgResult = await pool.query(
      `select email from public.users_data where email = $1`,
      [email]
    );
    console.log('auth.repo', {
      pg: pgResult.rows[0].email,
      neo4j: result,
    });
    return !!pgResult.rows[0].email;
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
        }
      )
      .run();
    const pool = PostgresService.pool;
    const personRows = await pool.query(
      `select email,person from public.users_data where email = $1`,
      [email]
    );
    const person = personRows.rows[0]?.person;

    const pgResult = await pool.query(
      `call public.create(0,'public.tokens',$1 ,0,0,0,0,0); `,
      [
        PostgresService.convertObjectToHstore({
          person,
          token,
        }),
      ]
    );
    console.log('saveEmailToken', pgResult);
  }

  async findEmailToken(token: string) {
    const result = await this.db
      .query()
      .match(node('emailToken', 'EmailToken', { token }))
      .return([
        'emailToken.value as email',
        'emailToken.token as token',
        'emailToken.createdOn as createdOn',
      ])
      .asResult<EmailToken>()
      .first();

    const pool = PostgresService.pool;
    const pgResult = await pool.query(
      `
    with u as(
    select email, created_at, person from public.users_data
    ), t as (select token, person from public.tokens where token = $1 )
    select u.email, t.token, u.created_at from u inner join t using (person)
    `,
      [token]
    );
    console.log('findEmailToken', pgResult);
    return result;
  }

  async updatePasswordViaEmailToken(
    { token, email }: EmailToken,
    pash: string
  ): Promise<void> {
    await this.db
      .query()
      .raw(
        `
        MATCH(e:EmailToken {token: $token})
        DELETE e
        WITH *
        MATCH (:EmailAddress {value: $email})<-[:email {active: true}]-(user:User)
        OPTIONAL MATCH (user)-[oldPasswordRel:password]->(oldPassword)
        SET oldPasswordRel.active = false
        WITH user
        LIMIT 1
        MERGE (user)-[:password {active: true, createdAt: $createdAt}]->(password:Property)
        SET password.value = $password
        RETURN password
      `,
        {
          token,
          email,
          password: pash,
          createdAt: DateTime.local(),
        }
      )
      .first();
    const pool = PostgresService.pool;
    console.log('updatePasswordViaEmailToken');
    // const pgPersonRow = await pool.query(`call public.update()`, []);
  }

  async removeAllEmailTokensForEmail(email: string) {
    await this.db
      .query()
      .match([node('emailToken', 'EmailToken', { value: email })])
      .delete('emailToken')
      .run();
    console.log('removeAllEmailTokensForEmail');
  }

  async deactivateAllOtherSessions(session: Session) {
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('requestingUser'),
        relation('out', 'oldRel', 'token', ACTIVE),
        node('token', 'Token'),
      ])
      .where(not([{ 'token.value': session.token }]))
      .setValues({ 'oldRel.active': false })
      .run();
    console.log('deactivateAllOtherSession');
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
      .where(not([{ 'token.value': session.token }]))
      .setValues({ 'oldRel.active': false })
      .run();
    console.log('deactivateAllOtherSessionsByEmail');
  }
}
