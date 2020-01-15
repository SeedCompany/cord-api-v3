import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/core/database.service';
import { PrepareDatabaseOutputDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}
  async prepareDatabaseConstraintsAndIndexes(): Promise<
    PrepareDatabaseOutputDto
  > {
    const response = new PrepareDatabaseOutputDto();

    return response;
  }
}
