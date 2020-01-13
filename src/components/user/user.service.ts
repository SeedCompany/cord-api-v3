import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateUserOutputDto,
  ReadUserOutputDto,
  UpdateUserOutputDto,
  DeleteUserOutputDto,
  CreateUserInput,
  ReadUserInput,
  UpdateUserInput,
  DeleteUserInput,
} from './user.dto';

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {
  }

  async create(
    input: CreateUserInput,
  ): Promise<CreateUserOutputDto> {
    const response = new CreateUserOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (user:User {active: true, owningOrg: "seedcompany", email: $email, realFirstName: $realFirstName, realLastName: $realLastName, displayFirstName: $displayFirstName, displayLastName: $displayLastName}) ON CREATE SET user.id = $id, user.timestamp = datetime() RETURN user.id as id, user.email as email, user.realFirstName as realFirstName, user.realLastName as realLastName, user.displayFirstName as displayFirstName, user.displayLastName as displayLastName',
        {
          id,
          email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          displayLastName: input.displayLastName,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
        response.user.email = result.records[0].get('email');
        response.user.realFirstName = result.records[0].get('realFirstName');
        response.user.realLastName = result.records[0].get('realLastName');
        response.user.displayFirstName = result.records[0].get('displayFirstName');
        response.user.displayLastName = result.records[0].get('displayLastName');
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
        'MATCH (user:User {active: true, owningOrg: "seedcompany"}) WHERE user.id = $id RETURN user.id as id, user.email as email, user.realFirstName as realFirstName, user.realLastName as realLastName, user.displayFirstName as displayFirstName, user.displayLastName as displayLastName',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
        response.user.email = result.records[0].get('email');
        response.user.realFirstName = result.records[0].get('realFirstName');
        response.user.realLastName = result.records[0].get('realLastName');
        response.user.displayFirstName = result.records[0].get('displayFirstName');
        response.user.displayLastName = result.records[0].get('displayLastName');
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
        'MATCH (user:User {active: true, owningOrg: "seedcompany", id: $id}) SET user.email = $email, user.realFirstName = $realFirstName, user.realLastName = $realLastName, user.displayFirstName = $displayFirstName, user.displayLastName = $displayLastName RETURN user.id as id, user.email as email, user.realFirstName as realFirstName, user.realLastName as realLastName, user.displayFirstName as displayFirstName, user.displayLastName as displayLastName',
        {
          id: input.id,
          email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          displayLastName: input.displayLastName,
        },
      )
      .then(result => {
        if (result.records.length > 0) {

          response.user.id = result.records[0].get('id');
          response.user.email = result.records[0].get('email');
          response.user.realFirstName = result.records[0].get('realFirstName');
          response.user.realLastName = result.records[0].get('realLastName');
          response.user.displayFirstName = result.records[0].get('displayFirstName');
          response.user.displayLastName = result.records[0].get('displayLastName');
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
        'MATCH (user:User {active: true, owningOrg: "seedcompany", id: $id}) SET user.active = false RETURN user.id as id',
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
