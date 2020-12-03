import { Injectable } from '@nestjs/common';
import { DbV4 } from '../../core/database/v4/dbv4.service';
import { CreateOut } from '../../core/database/v4/dto/GenericOut';
import { User } from './dto';
import { DbUser } from './model';
import { FeUserOut } from './dbv4/index';

@Injectable()
export class UserRepository {
  constructor(private readonly dbv4: DbV4) {}

  async create(request: Partial<DbUser>): Promise<CreateOut> {
    const response = await this.dbv4.post<CreateOut>('user/create', request);

    return response;
  }

  async read(request: { id: string; requestorId: string }): Promise<FeUserOut> {
    console.log(request);
    const response = await this.dbv4.post<FeUserOut>('api/user/read', request);
    return response;
  }
}
