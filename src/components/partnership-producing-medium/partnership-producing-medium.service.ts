import { Injectable } from '@nestjs/common';
import { uniqBy } from 'lodash';
import {
  entries,
  ID,
  InputException,
  SecuredList,
  Session,
  UnauthorizedException,
} from '../../common';
import { ResourceResolver } from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { LanguageEngagement } from '../engagement';
import { IProject } from '../project';
import {
  PartnershipProducingMediumInput,
  SecuredPartnershipsProducingMediums,
} from './dto/partnership-producing-medium.dto';
import { PartnershipProducingMediumRepository } from './partnership-producing-medium.repository';

@Injectable()
export class PartnershipProducingMediumService {
  constructor(
    private readonly auth: AuthorizationService,
    private readonly resources: ResourceResolver,
    private readonly repo: PartnershipProducingMediumRepository
  ) {}

  async list(
    engagement: LanguageEngagement,
    session: Session
  ): Promise<SecuredPartnershipsProducingMediums> {
    const perms = await this.auth.getPermissions({
      resource: IProject,
      sessionOrUserId: session,
      sensitivity: engagement.sensitivity,
      otherRoles: engagement.scope,
    });
    if (!perms.partnership.canRead) {
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
      canCreate: perms.partnership.canEdit,
    };
  }

  async update(
    engagementId: ID,
    input: readonly PartnershipProducingMediumInput[],
    session: Session
  ) {
    if (uniqBy(input, (pair) => pair.medium).length !== input.length) {
      throw new InputException('A medium can only be mentioned once');
    }

    const engagement = await this.resources.lookup(
      LanguageEngagement,
      engagementId,
      session
    );

    const perms = await this.auth.getPermissions({
      resource: IProject,
      sessionOrUserId: session,
      sensitivity: engagement.sensitivity,
      otherRoles: engagement.scope,
    });
    if (!perms.partnership.canEdit) {
      throw new UnauthorizedException(
        `You do not have permission to update the partnerships producing mediums for this engagement`
      );
    }

    await this.repo.update(engagementId, input);
  }
}
