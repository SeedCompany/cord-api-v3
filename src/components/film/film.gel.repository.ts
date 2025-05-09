import { Injectable } from '@nestjs/common';
import { type PublicOf, type UnsecuredDto } from '~/common';
import { e, RepoFor } from '~/core/gel';
import * as scripture from '../scripture/gel.utils';
import { type CreateFilm, Film, type UpdateFilm } from './dto';
import { type FilmRepository } from './film.repository';

@Injectable()
export class FilmGelRepository
  extends RepoFor(Film, {
    hydrate: (film) => ({
      ...film['*'],
      scriptureReferences: scripture.hydrate(film.scripture),
    }),
    omit: ['create', 'update'],
  })
  implements PublicOf<FilmRepository>
{
  async create(input: CreateFilm): Promise<UnsecuredDto<Film>> {
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

  async update({ id, ...changes }: UpdateFilm): Promise<UnsecuredDto<Film>> {
    const query = e.params({ scripture: e.optional(scripture.type) }, ($) => {
      const film = e.cast(e.Film, e.uuid(id));
      const updated = e.update(film, () => ({
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
