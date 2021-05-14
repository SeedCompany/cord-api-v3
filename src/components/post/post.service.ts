import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from 'aws-sdk';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import {
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { CreatePost, Post, UpdatePost } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';

@Injectable()
export class PostService {
  private readonly securedProperties = {
    body: true,
    user: true,
    modifiedAt: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger('post:service') private readonly logger: ILogger
  ) {}

  async create(
    { parentId, ...input }: CreatePost,
    session: Session
  ): Promise<Post> {
    const createdAt = DateTime.local();
    const postId = await generateId();

    const secureProps = [
      {
        key: 'creator',
        value: session.userId,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'type',
        value: input.type,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'shareability',
        value: input.shareability,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'body',
        value: input.body,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'modifiedAt',
        value: createdAt,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    if (!parentId) {
      throw new ServerException(
        'A post must be associated with a parent node.'
      );
    }

    try {
      const createPost = this.db
        .query()
        .apply(matchRequestingUser(session))
        .apply(createBaseNode(postId, ['Post'], secureProps))
        .return('node.id as id');

      await createPost.first();

      await this.db
        .query()
        .match([
          [node('baseNode', 'BaseNode', { id: parentId })],
          [node('post', 'Post', { id: postId })],
        ])
        .create([
          node('baseNode'),
          relation('out', '', 'baseNode', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('post'),
        ])
        .return('post.id as id')
        .first();

      // FIXME: This is being refactored - leaving it commented out per Michael's instructions for now
      // await this.authorizationService.processNewBaseNode(
      //   new DbPost(),
      //   postId,
      //   session.userId
      // );

      return await this.readOne(postId, session);
    } catch (exception) {
      this.logger.warning('Failed to create post', {
        exception,
      });

      if (
        !(await this.db
          .query()
          .match([
            node('baseNode', 'BaseNode', {
              id: parentId,
            }),
          ])
          .return('baseNode.id')
          .first())
      ) {
        throw new InputException('parentId is invalid', 'post.parentId');
      }

      throw new ServerException('Failed to create post', exception);
    }
  }

  async readOne(postId: ID, session: Session): Promise<Post> {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Post', { id: postId })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Post>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find post', 'post.id');
    }

    const props = parsePropList(result.propList);
    const securedProps = await this.authorizationService.secureProperties({
      resource: Post,
      props: result.propList,
      sessionOrUserId: session,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      type: props.type,
      shareability: props.shareability,
      body: {
        value: props.body,
        canRead: true,
        canEdit: true,
      },
      creator: {
        value: props.creator,
        canRead: true,
        canEdit: true,
      },
      modifiedAt: props.modifiedAt,
      canDelete: await this.db.checkDeletePermission(postId, session),
    };
  }

  async update(input: UpdatePost, session: Session): Promise<Post> {
    const object = await this.readOne(input.id, session);

    await this.db.updateProperties({
      type: Post,
      object,
      changes: {
        body: input.body,
      },
    });

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find post', 'post.id');
    }

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete post', {
        exception,
      });

      throw new ServerException('Failed to delete post', exception);
    }
  }

  async securedList(
    { filter, ...input }: PostListInput,
    session: Session
  ): Promise<SecuredPostList> {
    const label = 'Post';

    // const query = this.db
    //   .query()
    //   .match([requestingUser(session), ...permissionsOfNode(label)])
    //   .call(calculateTotalAndPaginateList(Post, input));

    // FIXME: we haven't implemented permissioning here yet
    const query = this.db
      .query()
      .match([
        // FIXME: Until the authorizationService.processNewBaseNode refactor is complete, commenting the two lines below out and
        // simply querying the Post nodes directly
        // requestingUser(session),
        // ...permissionsOfNode(label),
        node('node', label),

        ...(filter.parentId
          ? [
              relation('in', 'member'),
              node('baseNode', 'BaseNode', {
                id: filter.parentId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList(Post, input));

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true, // FIXME: implement permissioning
      canCreate: true, // FIXME: implement permissioning
    };
  }
}
