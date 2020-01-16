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
  constructor(private readonly db: DatabaseService) {}

  async create(
    input: CreateUserInput,
    token: string,
  ): Promise<CreateUserOutputDto> {
    const response = new CreateUserOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        `
        MATCH (token:Token {active: true, value: $token})
        CREATE
          (user:User {
            id: $id,
            active: true,
            createdAt: datetime(),
            canCreateOrg: true
          })
          -[:email {active: true}]->
          (email:EmailAddress:Property {
            active: true,
            value: $email
          }),
          (user)-[:token {active: true, createdAt: datetime()}]->(token),
          (user)-[:password {active: true, createdAt: datetime()}]->
          (password:Property {
            active: true,
            value: $password
          }),
          (user)-[:realFirstName {active: true, createdAt: datetime()}]->
          (realFirstName:Property {
            active: true,
            value: $realFirstName
          }),
          (user)-[:realLastName {active: true, createdAt: datetime()}]->
          (realLastName:Property {
            active: true,
            value: $realLastName
          }),
          (user)-[:displayFirstName {active: true, createdAt: datetime()}]->
          (displayFirstName:Property {
            active: true,
            value: $displayFirstName
          }),
          (user)-[:displayLastName {active: true, createdAt: datetime()}]->
          (displayLastName:Property {
            active: true,
            value: $displayLastName
          })
        RETURN
          user.id as id,
          email.value as email,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName
        `,
        {
          id,
          token,
          email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          displayLastName: input.displayLastName,
          password: input.password,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
        response.user.email = result.records[0].get('email');
        response.user.realFirstName = result.records[0].get('realFirstName');
        response.user.realLastName = result.records[0].get('realLastName');
        response.user.displayFirstName = result.records[0].get(
          'displayFirstName',
        );
        response.user.displayLastName = result.records[0].get(
          'displayLastName',
        );
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(input: ReadUserInput): Promise<ReadUserOutputDto> {
    const response = new ReadUserOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `
        MATCH
          (user:User {active: true, id: $id}),
          (user)-[:email {active: true}]->(email:EmailAddress {active: true}),
          (user)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
          (user)-[:realLastName {active: true}]->(realLastName:Property {active: true}),
          (user)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
          (user)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
        RETURN
          user.id as id,
          email.value as email,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName
        `,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.user.id = result.records[0].get('id');
        response.user.email = result.records[0].get('email');
        response.user.realFirstName = result.records[0].get('realFirstName');
        response.user.realLastName = result.records[0].get('realLastName');
        response.user.displayFirstName = result.records[0].get(
          'displayFirstName',
        );
        response.user.displayLastName = result.records[0].get(
          'displayLastName',
        );
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
        `
        MATCH
          (user:User {active: true, id: $id}),
          (user)-[:email {active: true}]->(email:EmailAddress {active: true}),
          (user)-[:realFirstName {active: true}]->(realFirstName:Property {active: true}),
          (user)-[:realLastName {active: true}]->(realLastName:Property {active: true}),
          (user)-[:displayFirstName {active: true}]->(displayFirstName:Property {active: true}),
          (user)-[:displayLastName {active: true}]->(displayLastName:Property {active: true})
        SET
          email.value = $email,
          realFirstName.value = $realFirstName,
          realLastName.value = $realLastName,
          displayFirstName.value = $displayFirstName,
          displayLastName.value = $displayLastName
        RETURN
          user.id as id,
          email.value as email,
          realFirstName.value as realFirstName,
          realLastName.value as realLastName,
          displayFirstName.value as displayFirstName,
          displayLastName.value as displayLastName
        `,
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
          response.user.displayFirstName = result.records[0].get(
            'displayFirstName',
          );
          response.user.displayLastName = result.records[0].get(
            'displayLastName',
          );
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
        `
        MATCH
          (user:User {active: true, id: $id})
        SET
          user.active = false
        RETURN
          user.id as id
        `,
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
