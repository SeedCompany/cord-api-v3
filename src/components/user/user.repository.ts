import { Injectable } from '@nestjs/common';
import { GenericResponse } from '../../common/dto/generic-response.db.dto';
import { DbV4 } from '../../core/database/dbv4.service';
import { DbUser } from './model';

@Injectable()
export class UserRepository {
  constructor(private readonly dbv4: DbV4) {}
  async create(request: Partial<DbUser>): Promise<GenericResponse> {
    const response = await this.dbv4.post<GenericResponse>(
      'user/create',
      request
    );

    return response;
  }
}
