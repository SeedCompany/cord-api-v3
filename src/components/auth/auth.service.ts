import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/core/database.service';
import { CreateTokenOutputDto, LoginUserOutputDto } from './auth.dto';
import { generate } from 'shortid';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}
  async createToken(): Promise<CreateTokenOutputDto> {
    const response = new CreateTokenOutputDto();
    const token = 'token_' + generate();
    const session = this.db.driver.session();
    const result = await session.run(
      `
      CREATE (token:Token {
        active: true,
        createdAt: datetime(),
        value: $token
      })
      RETURN token.value as token
      `,
      {
        token,
      },
    );
    response.token = result.records[0].get('token');
    session.close();
    return response;
  }
  async loginUser(username: string, password: string, token: string): Promise<LoginUserOutputDto>{
    const response = new LoginUserOutputDto();
    const session = this.db.driver.session();
    const result = await session.run(
      `
      MATCH 
        (token:Token {active: true, token: $token}),
        (user:User {username: $username, password: $password})
      CREATE (user)-[:token {createdAt: datetime()}]->(token)
      RETURN token.token as token
      `,
      {
        token,
        username,
        password,
      },
    );
    response.success = (result.records[0].get('token') === token);
    session.close();
    return response;
  }
}
