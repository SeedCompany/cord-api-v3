import { Injectable } from '@nestjs/common';
import { ID, Session } from '~/common';
import { AuthenticationEdgedbRepository } from './authentication.edgedb.repository';
import { LoginInput } from './dto';
import { connectSessionToUser } from './queries/connectSessionToUser.edgeql';
import { savePasswordHashOnUser } from './queries/savePasswordHashOnUser.edgeql';

@Injectable()
export class AuthenticationEdgedbQueriesRepository extends AuthenticationEdgedbRepository {
  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await savePasswordHashOnUser(this.db, { userId, passwordHash });
  }

  async connectSessionToUser(input: LoginInput, session: Session): Promise<ID> {
    const result = await connectSessionToUser(this.db, {
      email: input.email,
      token: session.token,
    });
    return result.id;
  }
}
