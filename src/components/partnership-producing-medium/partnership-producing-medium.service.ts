import { Injectable } from '@nestjs/common';
import { entries } from '@seedcompany/common';
import { uniqBy } from 'lodash';
import {
  type ID,
  InputException,
  SecuredList,
  UnauthorizedException,
} from '~/common';
import { ResourceResolver } from '~/core';
import { LiveQueryStore } from '~/core/live-query';
import { Privileges } from '../authorization';
import { LanguageEngagement } from '../engagement/dto';
import { IProject } from '../project/dto';
import {
  type SecuredPartnershipsProducingMediums,
  type UpdatePartnershipProducingMedium,
} from './dto/partnership-producing-medium.dto';
import { PartnershipProducingMediumRepository } from './partnership-producing-medium.repository';

@Injectable()
export class PartnershipProducingMediumService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceResolver,
    private readonly liveQueryStore: LiveQueryStore,
    private readonly repo: PartnershipProducingMediumRepository,
  ) {}

  async list(
    engagement: LanguageEngagement,
  ): Promise<SecuredPartnershipsProducingMediums> {
    const perms = this.privileges.for(IProject, engagement as any);

    if (!perms.can('read', 'partnership')) {
      return SecuredList.Redacted;
    }

    const map = await this.repo.read(engagement.id);
    const list = entries(map).map(([medium, partnership]) => ({
      medium,
      partnership,
    }));

    return {
      items: list,
      total: list.length,
      hasMore: false,
      canRead: true,
      canCreate: perms.can('create', 'partnership'),
    };
  }

  async update(
    engagementId: ID,
    input: readonly UpdatePartnershipProducingMedium[],
  ) {
    if (uniqBy(input, (pair) => pair.medium).length !== input.length) {
      throw new InputException('A medium can only be mentioned once');
    }

    const engagement = await this.resources.lookup(
      LanguageEngagement,
      engagementId,
    );

    const perms = this.privileges.for(IProject, engagement as any);

    if (!perms.can('create', 'partnership')) {
      throw new UnauthorizedException(
        `You do not have permission to update the partnerships producing mediums for this engagement`,
      );
    }

    await this.repo.update(engagementId, input);

    this.liveQueryStore.invalidate(
      `LanguageEngagement:${engagementId}:partnerships-producing-mediums`,
    );
  }
}
