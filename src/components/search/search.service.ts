import { Injectable } from '@nestjs/common';
import { ISession } from '../../common';
import { SearchInput, SearchOutput } from './dto';

@Injectable()
export class SearchService {
  async search(_input: SearchInput, _session: ISession): Promise<SearchOutput> {
    return {
      items: [],
    };
  }
}
