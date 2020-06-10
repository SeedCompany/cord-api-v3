/* eslint-disable */

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService, ILogger, Logger } from '../../core';
import { QueryService } from '../../core/query/query.service';
import { UserService } from '../user';
import { generate } from 'shortid';

const fetch = require('node-fetch');

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db2: QueryService,
    private readonly config: ConfigService,
    @Logger('admin:service') private readonly logger: ILogger
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.db2.mergeRootAdminUserAndSecurityGroup(
        this.config.rootAdmin.email,
        this.config.rootAdmin.password
      );
    });
  }

  async sendGraphql(query: {}, variables?: {}, cookie?: string) {
    if (cookie) {
      const result = await fetch('http://127.0.0.1:3000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'cordsession=' + cookie,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      return await result.json();
    } else {
      const result = await fetch('http://127.0.0.1:3000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      return await result.json();
    }
  }

  async startSession(): Promise<string> {
    // start session and get token
    const getTokenQuery = `
        query {
          session(browser: true) {
            token
            user {
              id
              
            }
          }
        }
        `;

    const result = await this.sendGraphql(getTokenQuery);

    if (result.errors) {
      this.logger.info('failed to start session');
      return '';
    }

    return result.data.session.token;
  }

  async login(email: string, password: string, token: string): Promise<string> {
    const logInAsRootQuery = `
    mutation{
      login(input:{email:"${email}", password:"${password}"}) {
       user{
         id
       }
     }
   }
    `;

    const result = await this.sendGraphql(logInAsRootQuery, {}, token);

    if (result.errors) {
      this.logger.info('failed to login as root ' + email);
      return '';
    }

    return result.data.login.user.id;
  }

  async createOrg(orgName: string, token: string): Promise<string> {
    const query = `
    mutation {
      createOrganization(input:{organization:{name:"${orgName}"}}){
        organization{
          id           
        }
      }
    }
    `;

    const result = await this.sendGraphql(query, {}, token);

    if (result.errors) {
      this.logger.info('failed to create org ' + orgName);
      return '';
    }

    return result.data.createOrganization.organization.id;
  }

  async createUser(email: string, token: string): Promise<string> {
    const query = `
    mutation {
      createUser(
        input: {
          user: {
            email: "${email}"
            realFirstName: "realFirstName"
            realLastName: "realLastName"
            displayFirstName: "displayFirstName"
            displayLastName: "displayLastName"
            phone: "637-5309"
            timezone: "timezone"
            bio: "bio"
            password: "password"
          }
        }
      ) {
        user {
          id
        }
      }
    }
    `;

    const result = await this.sendGraphql(query, {}, token);

    if (result.errors) {
      this.logger.info('failed to create user ' + email);
      return '';
    }

    return result.data.createUser.user.id;
  }

  async runTest1() {
    try {
      this.logger.info('runTest1');

      const token = await this.startSession();

      // log in as root
      const rootUserId = await this.login(
        this.config.rootAdmin.email,
        this.config.rootAdmin.password,
        token
      );

      // create orgs
      const seedOrgId = await this.createOrg('Seed Company', token);
      const wycliffeOrgId = await this.createOrg('Wycliffe USA', token);
      const silOrgId = await this.createOrg('SIL', token);

      // create users
      const user1 = await this.createUser(
        `email_${generate()}@asdf.com`,
        token
      );

      this.logger.info('user1: ' + user1);

      const user2 = await this.createUser(
        `email_${generate()}@asdf.com`,
        token
      );

      this.logger.info('user2: ' + user2);
    } catch (e) {
      this.logger.error(e);
    }

    return true;
  }
}
