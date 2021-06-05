import { Injectable } from '@nestjs/common';
import { node, not, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
import { DatabaseService, matchRequestingUser } from '../../core';
import { LoginInput } from './authentication.dto';

@Injectable()
export class AuthenticationRepository {
  constructor(private readonly db: DatabaseService) {}
  async createToken(token: string): Promise<Dictionary<any> | undefined> {
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
    return result;
  }

  async userFromSession(
    session: Session
  ): Promise<Dictionary<any> | undefined> {
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
      .first();
    return userRes;
  }

  async register(userId: ID, passwordHash: string): Promise<void> {
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
  }

  async login1(
    input: LoginInput,
    session: Session
  ): Promise<Dictionary<any> | undefined> {
    const result1 = await this.db
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
      .first();
    return result1;
  }

  async login2(input: LoginInput, session: Session) {
    const result2 = await this.db
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
      .first();
    return result2;
  }
  async logout(token: string): Promise<void> {
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

  async createSession(token: string): Promise<Dictionary<any> | undefined> {
    // check token in db to verify the user id and owning org id.
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
        relation('in', '', 'token', { active: true }),
        node('user', 'User'),
      ])
      .return('token, user.id AS userId')
      .first();

    return result;
  }

  async changePassword(session: Session): Promise<
    | {
        passwordHash: string;
      }
    | undefined
  > {
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('requestingUser'),
        relation('out', '', 'password', { active: true }),
        node('password', 'Property'),
      ])
      .return('password.value as passwordHash')
      .asResult<{ passwordHash: string }>()
      .first();
    return result;
  }
  async createNewPassword(
    newPasswordHash: string,
    session: Session
  ): Promise<void> {
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('requestingUser'),
        relation('out', '', 'password', { active: true }),
        node('password', 'Property'),
      ])
      .setValues({
        'password.value': newPasswordHash,
      })
      .return('password.value as passwordHash')
      .first();

    // inactivate all the relationships between the current user and all of their tokens except current one
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('requestingUser'),
        relation('out', 'oldRel', 'token', { active: true }),
        node('token', 'Token'),
      ])
      .where(not([{ 'token.value': session.token }]))
      .setValues({ 'oldRel.active': false })
      .run();
  }
  async forgotPasswordFindEmail(email: string) {
    const result = await this.db
      .query()
      .raw(
        `
      MATCH
      (email:EmailAddress {
        value: $email
      })
      RETURN
      email.value as email
      `,
        {
          email: email,
        }
      )
      .first();
    return result;
  }

  async forgotPasswordCreateToken(email: string, token: string): Promise<void> {
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
      .first();
  }

  async resetPassword(token: string): Promise<Dictionary<any> | undefined> {
    const result = await this.db
      .query()
      .raw(
        `
      MATCH(emailToken: EmailToken{token: $token})
      RETURN emailToken.value as email, emailToken.token as token, emailToken.createdOn as createdOn
      `,
        {
          token: token,
        }
      )
      .first();
    return result;
  }

  async resetPasswordRemoveOldData(
    token: string,
    result: Dictionary<any>,
    pash: string,
    session: Session
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
          email: result.email,
          password: pash,
          createdAt: DateTime.local(),
        }
      )
      .first();

    // remove all the email tokens and invalidate old tokens
    await this.db
      .query()
      .match([node('emailToken', 'EmailToken', { value: result.email })])
      .delete('emailToken')
      .run();

    await this.db
      .query()
      .match([
        node('emailAddress', 'EmailAddress', { value: result.email }),
        relation('in', '', 'email', { active: true }),
        node('user', 'User'),
        relation('out', 'oldRel', 'token', { active: true }),
        node('token', 'Token'),
      ])
      .where(not([{ 'token.value': session.token }]))
      .setValues({ 'oldRel.active': false })
      .run();
  }
}
