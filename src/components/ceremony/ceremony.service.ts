import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  type CalendarDate,
  type ID,
  type ObjectView,
  RangeException,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Hooks } from '~/core/hooks';
import { HandleIdLookup, ResourceLoader } from '~/core/resources';
import { ResourceMutatedHook } from '../audit/resource-mutated.hook';
import { Privileges } from '../authorization';
import { CeremonyChannels } from './ceremony.channels';
import { CeremonyRepository } from './ceremony.repository';
import {
  Ceremony,
  CeremonyType,
  CeremonyUpdate,
  type CreateCeremony,
  type UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyService {
  constructor(
    private readonly privileges: Privileges,
    private readonly channels: CeremonyChannels,
    private readonly repo: CeremonyRepository,
    private readonly hooks: Hooks,
    private readonly resourceLoader: ResourceLoader,
  ) {}

  async create(
    input: CreateCeremony,
    engagementId: ID<'Engagement'>,
  ): Promise<ID> {
    const { id } = await this.repo.create(input, engagementId);
    await this.hooks.run(new ResourceMutatedHook('Ceremony', id, 'Create'));

    this.channels.publishToAll('created', {
      ceremony: id,
      at: DateTime.now(),
    });

    return id;
  }

  @HandleIdLookup(Ceremony)
  async readOne(id: ID, _view?: ObjectView): Promise<Ceremony> {
    const dto = await this.repo.readOne(id);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[]) {
    const ceremonies = await this.repo.readMany(ids);
    return ceremonies.map((dto) => this.secure(dto));
  }

  secure(dto: UnsecuredDto<Ceremony>) {
    return this.privileges.for(Ceremony).secure(dto);
  }

  async update(input: UpdateCeremony) {
    const object = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(object, input);

    if (Object.keys(changes).length === 0) {
      return { ceremony: this.secure(object) };
    }

    this.privileges.for(Ceremony, object).verifyChanges(changes);
    await this.verifyDatesAfterEngagementStart(object, changes);
    const updated = await this.repo.update({
      id: input.id,
      ...changes,
    });
    await this.hooks.run(
      new ResourceMutatedHook('Ceremony', input.id, 'Update', changes),
    );

    const payload = this.channels.publishToAll('updated', {
      ceremony: updated.id,
      at: DateTime.now(),
      updated: CeremonyUpdate.fromInput(changes),
      previous: CeremonyUpdate.pickPrevious(object, changes),
    });

    return { ceremony: this.secure(updated), payload };
  }

  private async verifyDatesAfterEngagementStart(
    ceremony: UnsecuredDto<Ceremony>,
    changes: Partial<
      Pick<UnsecuredDto<Ceremony>, 'estimatedDate' | 'actualDate'>
    >,
  ) {
    if (
      ceremony.type !== CeremonyType.Certification ||
      (!changes.estimatedDate && !changes.actualDate)
    ) {
      return;
    }
    const engagement = await this.resourceLoader.load(
      'Engagement',
      ceremony.engagement.id,
    );
    CertificationDateException.throwIfBeforeStart(
      engagement.startDate.value,
      changes,
    );
  }

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOne(id);

    // Only called internally, not exposed directly to users
    // this.privileges.for( Ceremony, object).verifyCan('delete');

    try {
      await this.repo.delete(object.id);
    } catch (exception) {
      throw new ServerException('Failed to delete Ceremony', exception);
    }
    await this.hooks.run(new ResourceMutatedHook('Ceremony', id, 'Delete'));

    this.channels.publishToAll('deleted', {
      ceremony: id,
      at: DateTime.now(),
    });
  }
}

class CertificationDateException extends RangeException {
  /**
   * Throws if a changed certification date is before the engagement start.
   *
   * Dates after the engagement end are allowed.
   *
   * @example
   * ```ts
   * // engagement starts 2026-01-01
   * throwIfBeforeStart(start, { actualDate: CalendarDate.local(2025, 12, 31) });
   * // => throws, field "ceremony.actualDate"
   * ```
   */
  static throwIfBeforeStart(
    startDate: CalendarDate | null | undefined,
    changes: Partial<
      Pick<UnsecuredDto<Ceremony>, 'estimatedDate' | 'actualDate'>
    >,
  ) {
    if (!startDate) {
      return;
    }
    if (changes.estimatedDate && changes.estimatedDate < startDate) {
      throw new CertificationDateException(
        "Estimated certification date cannot be before the engagement's start date",
        'ceremony.estimatedDate',
      );
    }
    if (changes.actualDate && changes.actualDate < startDate) {
      throw new CertificationDateException(
        "Actual certification date cannot be before the engagement's start date",
        'ceremony.actualDate',
      );
    }
  }

  constructor(message: string, field: string) {
    super({ message, field });
  }
}
