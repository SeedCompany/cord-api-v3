import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateProductStep,
  ProductStep,
  ProductStepListInput,
  SecuredProductStepList,
  UpdateProductStep,
} from './dto';
import { ProductStepRepository } from './product-step.repository';

@Injectable()
export class ProductStepService {
  constructor(
    @Logger('product:step:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: ProductStepRepository
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:ProductStep) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:ProductStep) ASSERT n.id IS UNIQUE',
    ];
  }

  async create(
    input: CreateProductStep,
    session: Session
  ): Promise<ProductStep> {
    const id = await generateId();
    const createdAt = DateTime.local();

    try {
      const result = await this.repo.create(input, createdAt, id);

      if (!result) {
        throw new ServerException('Failed to create a product step');
      }

      await this.repo.createProperties(input, result);

      return await this.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create product step', exception);
    }
  }

  async readOne(id: ID, session: Session): Promise<ProductStep> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No product step id to search for',
        'productStep.id'
      );
    }

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException(
        'Could not find product step',
        'productStep.id'
      );
    }

    const props = parsePropList(result.propList);
    const securedProps = await this.authorizationService.secureProperties(
      ProductStep,
      props,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...props,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(id, session),
    };
  }

  async list(
    productId: string,
    { filter, ...input }: ProductStepListInput,
    session: Session
  ): Promise<SecuredProductStepList> {
    const query = this.repo.list(productId, {
      filter,
      ...input,
    });

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true,
      canCreate: true,
    };
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Product Step');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Organization'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted organization with id`, { id });
  }

  async update(
    input: UpdateProductStep,
    session: Session
  ): Promise<ProductStep> {
    const productStep = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(productStep, input);

    await this.authorizationService.verifyCanEditChanges(
      ProductStep,
      productStep,
      changes
    );

    return await this.repo.updateProperties(productStep, changes);
  }
}
