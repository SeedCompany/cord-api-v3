import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbSong extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbSong';
  name: any = null;
  scriptureReferences: any = null;
}
