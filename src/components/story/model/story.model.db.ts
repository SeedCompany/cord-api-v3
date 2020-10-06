import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbStory extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbStory';
  name: any = null;
  scriptureReferences: any = null;
}
