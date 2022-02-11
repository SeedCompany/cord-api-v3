import { Injectable } from '@nestjs/common';
import { Client, Pool } from 'pg';

@Injectable()
export class Pg {
  constructor(private readonly pool: Pool) {}

  async query<R = unknown>(
    queryText: string,
    values?: unknown[]
  ): Promise<readonly R[]> {
    const result = await this.pool.query<R>(queryText, values);
    return result.rows;
  }

  escapeIdentifier(str: string): string {
    return Client.prototype.escapeIdentifier(str);
  }
  escapeLiteral(str: string): string {
    return Client.prototype.escapeLiteral(str);
  }
}
