import { Injectable } from '@nestjs/common';
import { CreateResponse } from '../../common/dto/generic-response.db.dto';
import { DbV4 } from '../../core/database/v4/dbv4.service';
import { DbUser } from './model';

@Injectable()
export class UserRepository {
  constructor(private readonly dbv4: DbV4) {}
  async create(request: Partial<DbUser>): Promise<CreateResponse> {
    const response = await this.dbv4.post<CreateResponse>(
      'user/create',
      request
    );

    return response;
  }
}
