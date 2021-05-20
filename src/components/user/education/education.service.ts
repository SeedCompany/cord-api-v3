import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../../core';
import {
  parseBaseNodeProperties,
  runListQuery,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { DbEducation } from '../model';
import {
  CreateEducation,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';
import { EducationRepository } from './education.repository';

@Injectable()
export class EducationService {
  constructor(
    @Logger('education:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: EducationRepository
  ) {}

  async create(
    { userId, ...input }: CreateEducation,
    session: Session
  ): Promise<Education> {
    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'degree',
        value: input.degree,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'institution',
        value: input.institution,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'major',
        value: input.major,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create education
    const result = await this.repo.create(
      userId,
      secureProps,
      createdAt,
      session
    );

    if (!result) {
      throw new ServerException('failed to create education');
    }

    const dbEducation = new DbEducation();
    await this.authorizationService.processNewBaseNode(
      dbEducation,
      result.id,
      userId
    );

    this.logger.debug(`education created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<Education> {
    this.logger.debug(`Read Education`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException('Could not find education', 'education.id');
    }

    const secured = await this.authorizationService.secureProperties({
      resource: Education,
      props: result.propList,
      sessionOrUserId: session,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      canDelete: await this.repo.checkDeletePermission(id, session), // TODO
    };
  }

  async update(input: UpdateEducation, session: Session): Promise<Education> {
    const ed = await this.readOne(input.id, session);
    const result = await this.repo.getUserEducation(session, input.id);
    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with education',
        'user.education'
      );
    }
    const changes = this.repo.getActualChanges(ed, input);
    if (result.user.properties.id !== session.userId) {
      await this.authorizationService.verifyCanEditChanges(
        Education,
        ed,
        changes
      );
    }

    await this.repo.updateProperties(ed, changes);
    return await this.readOne(input.id, session);
  }

  async delete(_id: ID, _session: Session): Promise<void> {
    // Not Implemented
  }

  async list(
    { filter, ...input }: EducationListInput,
    session: Session
  ): Promise<EducationListOutput> {
    const query = this.repo.list({ filter, ...input }, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async checkEducationConsistency(session: Session): Promise<boolean> {
    const educations = await this.repo.getEducations(session);

    return (
      (
        await Promise.all(
          educations.map(async (education) => {
            return await this.repo.hasProperties(session, education);
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          educations.map(async (education) => {
            return await this.repo.isUniqueProperties(session, education);
          })
        )
      ).every((n) => n)
    );
  }
}
