import { Injectable } from '@nestjs/common';
import { PublicOf, UnsecuredDto } from '~/common';
import { e, RepoFor } from '~/core/gel';
import * as scripture from '../scripture/gel.utils';
import { CreateStory, Story, UpdateStory } from './dto';
import { StoryRepository } from './story.repository';

@Injectable()
export class StoryGelRepository
  extends RepoFor(Story, {
    hydrate: (story) => ({
      ...story['*'],
      scriptureReferences: scripture.hydrate(story.scripture),
    }),
    omit: ['create', 'update'],
  })
  implements PublicOf<StoryRepository>
{
  async create(input: CreateStory): Promise<UnsecuredDto<Story>> {
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

  async update({ id, ...changes }: UpdateStory): Promise<UnsecuredDto<Story>> {
    const query = e.params({ scripture: e.optional(scripture.type) }, ($) => {
      const story = e.cast(e.Story, e.uuid(id));
      const updated = e.update(story, () => ({
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
