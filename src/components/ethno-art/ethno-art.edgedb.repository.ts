import { Injectable } from '@nestjs/common';
import { PublicOf, UnsecuredDto } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import * as scripture from '../scripture/edgedb.utils';
import { CreateEthnoArt, EthnoArt, UpdateEthnoArt } from './dto';
import { EthnoArtRepository } from './ethno-art.repository';

@Injectable()
export class EthnoArtEdgeDBRepository
  extends RepoFor(EthnoArt, {
    hydrate: (ethnoArt) => ({
      ...ethnoArt['*'],
      scriptureReferences: scripture.hydrate(ethnoArt.scripture),
    }),
    omit: ['create', 'update'],
  })
  implements PublicOf<EthnoArtRepository>
{
  async create(input: CreateEthnoArt): Promise<UnsecuredDto<EthnoArt>> {
    const query = e.params(
      { name: e.str, scripture: e.optional(scripture.type) },
      ($) => {
        const created = e.insert(this.resource.db, {
          name: $.name,
          scripture: scripture.insert($.scripture),
        });
        return e.select(created, this.hydrate);
      },
    );
    return await this.db.run(query, {
      name: input.name,
      scripture: scripture.valueOptional(input.scriptureReferences),
    });
  }

  async update({
    id,
    ...changes
  }: UpdateEthnoArt): Promise<UnsecuredDto<EthnoArt>> {
    const query = e.params({ scripture: e.optional(scripture.type) }, ($) => {
      const ethnoArt = e.cast(e.EthnoArt, e.uuid(id));
      const updated = e.update(ethnoArt, () => ({
        set: {
          ...(changes.name ? { name: changes.name } : {}),
          ...(changes.scriptureReferences !== undefined
            ? { scripture: scripture.insert($.scripture) }
            : {}),
        },
      }));
      return e.select(updated, this.hydrate);
    });
    return await this.db.run(query, {
      scripture: scripture.valueOptional(changes.scriptureReferences),
    });
  }
}
