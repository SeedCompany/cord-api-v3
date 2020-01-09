import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateUserOutputDto,
  CreateUserInput,
  // CreateUserInputDto,
  ReadUserOutputDto,
  ReadUserInput,
  UpdateUserOutputDto,
  DeleteUserOutputDto,
  UpdateUserInput,
  DeleteUserInput,
} from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    input: CreateUserInput,
  ): Promise<CreateUserOutputDto> {
    const response = new CreateUserOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (user:User {active: true, email: $email}) ON CREATE SET user.id = $id, user.timestamp = datetime() RETURN user.id as id, user.email as email',
        {
          id,
          email: input.email,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
        response.user.email = result.records[0].get('email');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadUserInput,
  ): Promise<ReadUserOutputDto> {
    const response = new ReadUserOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (user:User {active: true}) WHERE user.id = $id RETURN user.id as id, user.email as email',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
        response.user.email = result.records[0].get('email');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateUserInput): Promise<UpdateUserOutputDto> {
    const response = new UpdateUserOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (user:User {active: true, id: $id}) SET user.email = $email RETURN user.id as id, user.email as email',
        {
          id: input.id,
          email: input.email,
        },
      )
      .then(result => {
        if (result.records.length > 0) {

          response.user.id = result.records[0].get('id');
          response.user.email = result.records[0].get('email');
        } else {
          response.user = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteUserInput): Promise<DeleteUserOutputDto> {
    const response = new DeleteUserOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (user:User {active: true, id: $id}) SET user.active = false RETURN user.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
