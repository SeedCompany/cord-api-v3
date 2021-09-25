import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  NotFoundException,
  PaginatedListType,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { IEventBus, ResourceResolver } from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { CreateDefinedFileVersionInput, FileService } from '../file';
import {
  CreateQuestionAnswer,
  QuestionAnswer,
  UpdateQuestionAnswer,
} from './dto';
import {
  AuthorizeQuestionAnswerCreationEvent,
  SecureQuestionAnswerEvent,
} from './events';
import { QuestionAnswerRepository } from './question-answer.repository';

@Injectable()
export class QuestionAnswerService {
  constructor(
    private readonly resources: ResourceResolver,
    private readonly eventBus: IEventBus,
    private readonly auth: AuthorizationService,
    private readonly files: FileService,
    private readonly repo: QuestionAnswerRepository
  ) {}

  async list(
    parent: ID,
    session: Session
  ): Promise<PaginatedListType<UnsecuredDto<QuestionAnswer>>> {
    return await this.repo.list(parent, session);
  }

  async create(
    input: CreateQuestionAnswer,
    session: Session
  ): Promise<QuestionAnswer> {
    const parentBase = await this.repo.getBaseNode(input.parentId);
    if (!parentBase) {
      throw new NotFoundException('Could not find parent', 'parentId');
    }
    const parent = await this.resources.lookupByBaseNode(parentBase, session);

    const createEvent = new AuthorizeQuestionAnswerCreationEvent(
      parent,
      input,
      session
    );
    await this.eventBus.publish(createEvent);
    if (!createEvent.isAllowed) {
      throw new InputException(
        'Questions/Answers cannot be assigned to this',
        'parentId'
      );
    }

    const dto = await this.repo.create(input, session);
    await this.addMedia(dto, input.media, session);

    return await this.secure(dto, session);
  }

  async update(
    { media, ...input }: UpdateQuestionAnswer,
    session: Session
  ): Promise<QuestionAnswer> {
    const existingUnsecured = await this.repo.readOne(input.id, session);
    const existing = await this.secure(existingUnsecured, session);

    const changes = this.repo.getActualChanges(existing, input);
    await this.auth.verifyCanEditChanges(QuestionAnswer, existing, {
      ...changes,
      ...(media && media.length > 0 ? { media } : {}),
    });

    const updated = await this.repo.updateProperties(existing, changes);
    await this.addMedia(existingUnsecured, media, session);

    return updated;
  }

  async delete(id: ID, session: Session) {
    const dto = await this.repo.readOne(id, session);
    const qa = await this.secure(dto, session);
    if (!qa.canDelete) {
      throw new UnauthorizedException(
        'You are not authorized to delete this question/answer'
      );
    }
    await this.repo.deleteNode(id);
  }

  private async addMedia(
    dto: UnsecuredDto<QuestionAnswer>,
    files: CreateDefinedFileVersionInput[] | undefined,
    session: Session
  ) {
    await Promise.all(
      (files ?? []).map((file) =>
        this.files.createFileVersion(
          {
            parentId: dto.media,
            ...file,
            name: file.name!, // Assume file name is given but this gql type should be fixed.
          },
          session
        )
      )
    );
  }

  private async secure(dto: UnsecuredDto<QuestionAnswer>, session: Session) {
    const parentType = this.resources.resolveTypeByBaseNode(dto.parent);
    const parent = { __typename: parentType, id: dto.parent.properties.id };
    const secureEvent = new SecureQuestionAnswerEvent(dto, parent, session);
    await this.eventBus.publish(secureEvent);
    if (!secureEvent.secured) {
      throw new ServerException('QuestionAnswer was not secured');
    }
    return secureEvent.secured;
  }
}
