import { Injectable } from '@nestjs/common';
import {
  CalendarDate,
  type ID,
  InputException,
  ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ResourceLoader } from '~/core';
import { Privileges } from '../authorization';
import { AllianceMembershipRepository } from './alliance-membership.repository';
import { type CreateAllianceMembership } from './dto';
import { AllianceMembership } from './dto/alliance-membership.dto';

@Injectable()
export class AllianceMembershipService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly repo: AllianceMembershipRepository,
  ) {}

  async create(input: CreateAllianceMembership): Promise<AllianceMembership> {
    if (input.memberId === input.allianceId) {
      throw new InputException(
        'An organization cannot be its own alliance member',
        'allianceMembership.member',
      );
    }

    // Set default joinedAt to today if not provided
    const inputWithDefaults = {
      ...input,
      joinedAt: input.joinedAt ?? CalendarDate.local(),
    };

    const created = await this.repo.create(inputWithDefaults);

    this.privileges.for(AllianceMembership, created).verifyCan('create');

    return this.secure(created);
  }

  @HandleIdLookup(AllianceMembership)
  async readOne(
    allianceId: ID,
    _view?: ObjectView,
  ): Promise<AllianceMembership> {
    const result = await this.repo.readOne(allianceId);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const allianceMemberships = await this.repo.readMany(ids);
    return allianceMemberships.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<AllianceMembership>): AllianceMembership {
    return this.privileges.for(AllianceMembership).secure(dto);
  }

  // async listAllianceMembers(
  //   organizationId: ID,
  // ): Promise<AllianceMembershipListOutput> {
  //   const input = AllianceMembershipListInput.defaultValue(
  //     AllianceMembershipListInput,
  //     {
  //       filter: { allianceId: organizationId },
  //     },
  //   );
  //   const result = await this.repo.list(input);
  //   return {
  //     ...result,
  //     items: result.items.map((dto) => this.secure(dto)),
  //   };
  // }

  // async listJoinedAlliances(
  //   organizationId: ID,
  // ): Promise<AllianceMembershipListOutput> {
  //   const input = AllianceMembershipListInput.defaultValue(
  //     AllianceMembershipListInput,
  //     {
  //       filter: { memberId: organizationId },
  //     },
  //   );
  //   const result = await this.repo.list(input);
  //   return {
  //     ...result,
  //     items: result.items.map((dto) => this.secure(dto)),
  //   };
  // }

  async delete(id: ID): Promise<void> {
    const membership = await this.readOne(id);
    this.privileges.for(AllianceMembership, membership).verifyCan('delete');

    try {
      await this.repo.deleteNode(id);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }
}
