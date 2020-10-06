import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbFilm extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbFilm';
  name: any = null;
  scriptureReferences: any = null;
}
