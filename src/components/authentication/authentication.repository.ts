import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, ServerException, Session } from '../../common';
import { DatabaseService, matchRequestingUser, Pg } from '../../core';
import { ACTIVE, variable } from '../../core/database/query';
import { LoginInput } from './dto';

interface EmailToken {
  email: string;
  token: string;
  createdOn: DateTime;
}

interface UserToken {
  userId?: ID;
  token?: string;
}

interface UserPash {
  id?: ID;
  pash?: string;
}

@Injectable()
export class AuthenticationRepository {
  constructor(private readonly pg: Pg, private readonly db: DatabaseService) {}

  async saveSessionToken(token: string) {
    //var asdf = await this.pg.query("SELECT * FROM admin.tokens")
    //console.log(asdf)

    //console.log(token)
    const res = await this.pg.query(
      "INSERT INTO admin.tokens (token, created_at) values ('" +
        token +
        "', now())"
    );
    if (!res) {
      throw new ServerException('Failed to save session token');
    }

    // const result = await this.db
    //   .query()
    //   .raw(
    //     `
    // CREATE
    //   (token:Token {
    //     active: true,
    //     createdAt: datetime(),
    //     value: $token
    //   })
    // RETURN
    //   token.value as token
    // `,
    //     {
    //       token,
    //     }
    //   )
    //   .first();
    // if (!result) {
    //   throw new ServerException('Failed to save session token');
    // }
  }

  async getUserFromSession(session: Session) {
    const result = await this.db
      .query()
      .raw('', { token: session.token })
      .match([
        node('token', 'Token', {
          ...ACTIVE,
          value: variable('$token'),
        }),
        relation('in', '', 'token', ACTIVE),
        node('user', 'User'),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();
    return result?.id;
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

  async getPasswordHash(input: LoginInput, session: Session) {
    let result: UserPash = {};
    try {
      const pgResult = await this.pg.query(
        'SELECT id, password as pash FROM admin.users WHERE email=$1',
        [input.email]
      );
      const res = pgResult[0] as UserPash;
      result = { id: res.id, pash: res.pash };
    } catch (error) {
      // console.log(error)
    }

    // console.log(result)
    const result2 = await this.db
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
    //console.log(result2)
    if (result) {
      return result.pash;
    } else {
      return result2?.pash;
    }
  }

  async connectSessionToUser(input: LoginInput, session: Session) {
    const pgResult = await this.pg.query(
      'UPDATE admin.tokens set person=(SELECT id FROM admin.users WHERE email=$1) WHERE token=$2 RETURNING person as id',
      [input.email, session.token]
    );

    const res = pgResult[0] as UserPash;
    const result: UserPash = { id: res.id };
    // result.id = res.id
    // console.log(session.token)
    // console.log(result)
    // const result = await this.db
    //   .query()
    //   .raw(
    //     `
    //     MATCH
    //       (token:Token {
    //         active: true,
    //         value: $token
    //       }),
    //       (:EmailAddress {value: $email})
    //       <-[:email {active: true}]-
    //       (user:User)
    //     OPTIONAL MATCH
    //       (token)-[r]-()
    //     DELETE r
    //     CREATE
    //       (user)-[:token {active: true, createdAt: datetime()}]->(token)
    //     RETURN
    //       user.id as id
    //   `,
    //     {
    //       token: session.token,
    //       email: input.email,
    //     }
    //   )
    //   .asResult<{ id: ID }>()
    //   .first();

    return result?.id;
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
  }

  async findSessionToken(token: string) {
    let result: UserToken = {};
    try {
      // console.log(token)
      const pgResult = await this.pg.query(
        'SELECT person as userId, token FROM admin.tokens WHERE token=$1',
        [token]
      );
      const tokenData = pgResult[0] as { userid: ID; token: string };
      result = { token: tokenData.token, userId: tokenData.userid };
      // console.log(result)
    } catch (e: unknown) {
      // somthing
    }

    // console.log("findSessionToken")
    // const result = await this.db
    //   .query()
    //   .raw('MATCH (token:Token { active: true, value: $token })', { token })
    //   .optionalMatch([
    //     node('token'),
    //     relation('in', '', 'token', ACTIVE),
    //     node('user', 'User'),
    //   ])
    //   .return('token, user.id AS userId')
    //   .asResult<{ token: string; userId?: ID }>()
    //   .first();
    // console.log(result )

    return result;
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
  }

  async doesEmailAddressExist(email: string) {
    const pgResult = await this.pg.query(
      'SELECT id, email FROM admin.users WHERE email=$1',
      [email]
    );
    const resData = pgResult[0] as { id: ID; email: string };
    // const result = await this.db
    //   .query()
    //   .match([node('email', 'EmailAddress', { value: email })])
    //   .return('email')
    //   .first();
    return !!resData;
  }

  async saveEmailToken(email: string, token: string): Promise<void> {
    await this.pg.query(
      `
      INSERT INTO admin.email_tokens (token, user_id) values ($1, (SELECT id FROM admin.users WHERE email=$2))
    `,
      [token, email]
    );

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
        }
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
      .apply(matchRequestingUser(session))
      .match([
        node('requestingUser'),
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
}
