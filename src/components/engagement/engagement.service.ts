import { Injectable, NotFoundException } from '@nestjs/common';
import { first, intersection } from 'lodash';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { CeremonyService } from '../ceremony';
import { CeremonyType } from '../ceremony/dto/type.enum';
import { LanguageService } from '../language';
import { LocationService } from '../location';
import {
  ProductListInput,
  ProductService,
  SecuredProductList,
} from '../product';
import { UserService } from '../user';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  EngagementListInput,
  EngagementListOutput,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';

@Injectable()
export class EngagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ceremonyService: CeremonyService,
    private readonly products: ProductService,
    private readonly userService: UserService,
    private readonly languageService: LanguageService,
    private readonly locationService: LocationService,
    @Logger(`engagement.service`) private readonly logger: ILogger
  ) {}
  async readOne(id: string, session: ISession): Promise<Engagement> {
    const qr = `
    MATCH (engagement {id: $id, active: true}) RETURN labels(engagement) as labels
    `;

    const results = await this.db.query().raw(qr, { id }).first();
    const label = first(
      intersection(results?.labels, [
        'LanguageEngagement',
        'InternshipEngagement',
      ])
    );

    let query = `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (languageEngagement:LanguageEngagement {active: true, id: $id})

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLanguage:ACL {canReadLanguage: true})-[:toNode]->(languageEngagement)-[:language {active: true}]->(language)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditLanguage:ACL {canEditLanguage: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadProject:ACL {canReadProject: true})-[:toNode]->(languageEngagement)<-[:engagement {active: true}]-(project)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditProject:ACL {canEditProject: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCeremony {canReadCeremony: true})-[:toNode]->(languageEngagement)-[:ceremony {active: true}]->(ceremony)
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCeremony {canEditCeremony: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadFirstScripture:ACL {canReadFirstScripture: true})-[:toNode]->(languageEngagement)-[:firstScripture {active: true}]->(firstScripture:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditFirstScripture:ACL {canEditFirstScripture: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLukePartnership:ACL {canReadLukePartnership: true})-[:toNode]->(languageEngagement)-[:lukePartnership {active: true}]->(lukePartnership:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditLukePartnership:ACL {canEditLukePartnership: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadSentPrintingDate:ACL {canReadSentPrintingDate: true})-[:toNode]->(languageEngagement)-[:sentPrintingDate {active: true}]->(sentPrintingDate:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditSentPrintingDate:ACL {canEditSentPrintingDate: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStatus:ACL {canReadStatus: true})-[:toNode]->(languageEngagement)-[:status {active: true}]->(status:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditStatus:ACL {canEditStatus: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCompleteDate:ACL {canReadCompleteDate: true})-[:toNode]->(languageEngagement)-[:completeDate {active: true}]->(completeDate:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCompleteDate:ACL {canEditCompleteDate: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(CanReadDisbursementCompleteDate:ACL {CanReadDisbursementCompleteDate: true})-[:toNode]->(languageEngagement)-[:disbursementCompleteDate {active: true}]->(disbursementCompleteDate:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(CanEditDisbursementCompleteDate:ACL {CanEditDisbursementCompleteDate: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCommunicationsCompleteDate:ACL {canReadCommunicationsCompleteDate: true})-[:toNode]->(languageEngagement)-[:communicationsCompleteDate {active: true}]->(communicationsCompleteDate:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCommunicationsCompleteDate:ACL {canEditCommunicationsCompleteDate: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStartDate:ACL {canReadStartDate: true})-[:toNode]->(languageEngagement)-[:startDate {active: true}]->(startDate:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditStartDate:ACL {canEditStartDate: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadEndDate:ACL {canReadEndDate: true})-[:toNode]->(languageEngagement)-[:endDate {active: true}]->(endDate:Property {active: true})
      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditEndDate:ACL {canEditEndDate: true})-[:toNode]->(languageEngagement)

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadInitialEndDate:ACL {canReadInitialEndDate: true})-[:toNode]->(languageEngagement)-[:initialEndDate {active: true}]->(initialEndDate:Property {active: true})

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLastSuspendedAt:ACL {canReadLastSuspendedAt: true})-[:toNode]->(languageEngagement)-[:lastSuspendedAt {active: true}]->(lastSuspendedAt:Property {active: true})

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLastReactivatedAt:ACL {canReadLastReactivatedAt: true})-[:toNode]->(languageEngagement)-[:lastReactivatedAt {active: true}]->(lastReactivatedAt:Property {active: true})

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStatusModifiedAt:ACL {canReadStatusModifiedAt: true})-[:toNode]->(languageEngagement)-[:statusModifiedAt {active: true}]->(statusModifiedAt:Property {active: true})

      WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadModifiedAt:ACL {canReadModifiedAt: true})-[:toNode]->(languageEngagement)-[:modifiedAt {active: true}]->(modifiedAt:Property {active: true})

      RETURN
        languageEngagement.id as id,
        languageEngagement.createdAt as createdAt,
        language.id as languageId,
        project as project,
        ceremony.id as ceremonyId,
        firstScripture.value as firstScripture,
        lukePartnership.value as lukePartnership,
        sentPrintingDate.value as sentPrintingDate,
        status.value as status,
        completeDate.value as completeDate,
        disbursementCompleteDate.value as disbursementCompleteDate,
        communicationsCompleteDate.value as communicationsCompleteDate,
        startDate.value as startDate,
        endDate.value as endDate,
        initialEndDate.value as initialEndDate,
        lastSuspendedAt.value as lastSuspendedAt,
        lastReactivatedAt.value as lastReactivatedAt,
        statusModifiedAt.value as statusModifiedAt,
        modifiedAt.value as modifiedAt,
        canReadLanguage.canReadLanguage as canReadLanguage,
        canEditLanguage.canEditLanguage as canEditLanguage,
        canReadCeremony.canReadCeremony as canReadCeremony,
        canEditCeremony.canEditCeremony as canEditCeremony,
        canReadFirstScripture.canReadFirstScripture as canReadFirstScripture,
        canEditFirstScripture.canEditFirstScripture as canEditFirstScripture,
        canReadLukePartnership.canReadLukePartnership as canReadLukePartnership,
        canEditLukePartnership.canEditLukePartnership as canEditLukePartnership,
        canReadSentPrintingDate.canReadSentPrintingDate as canReadSentPrintingDate,
        canEditSentPrintingDate.canEditSentPrintingDate as canEditSentPrintingDate,
        canReadStatus.canReadStatus as canReadStatus,
        canEditStatus.canEditStatus as canEditStatus,
        canReadCompleteDate.canReadCompleteDate as canReadCompleteDate,
        canEditCompleteDate.canEditCompleteDate as canEditCompleteDate,
        CanReadDisbursementCompleteDate.CanReadDisbursementCompleteDate as CanReadDisbursementCompleteDate,
        CanEditDisbursementCompleteDate.CanEditDisbursementCompleteDate as CanEditDisbursementCompleteDate,
        canReadCommunicationsCompleteDate.canReadCommunicationsCompleteDate as canReadCommunicationsCompleteDate,
        canEditCommunicationsCompleteDate.canEditCommunicationsCompleteDate as canEditCommunicationsCompleteDate,
        canReadStartDate.canReadStartDate as canReadStartDate,
        canEditStartDate.canEditStartDate as canEditStartDate,
        canReadEndDate.canReadEndDate as canReadEndDate,
        canEditEndDate.canEditEndDate as canEditEndDate,
        canReadInitialEndDate.canReadInitialEndDate as canReadInitialEndDate,
        canReadLastSuspendedAt.canReadLastSuspendedAt as canReadLastSuspendedAt,
        canReadLastReactivatedAt.canReadLastReactivatedAt as canReadLastReactivatedAt,
        canReadStatusModifiedAt.canReadStatusModifiedAt as canReadStatusModifiedAt,
        canReadModifiedAt.canReadModifiedAt as canReadModifiedAt
    `;

    if (label === 'InternshipEngagement') {
      query = `
        MATCH
          (token:Token {
            active: true,
            value: $token
          })
            <-[:token {active: true}]-
          (requestingUser:User {
            active: true,
            id: $requestingUserId,
            owningOrgId: $owningOrgId
          }),
          (internshipEngagement:InternshipEngagement {active: true, id: $id})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadProject:ACL {canReadProject: true})-[:toNode]->(internshipEngagement)<-[:engagement {active: true}]-(project)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditProject:ACL {canEditProject: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCeremony {canReadCeremony: true})-[:toNode]->(internshipEngagement)-[:ceremony {active: true}]->(ceremony)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCeremony {canEditCeremony: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadIntern:ACL {canReadIntern: true})-[:toNode]->(internshipEngagement)-[:intern {active: true}]->(internUser)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditIntern:ACL {canEditIntern: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMentor:ACL {canReadMentor: true})-[:toNode]->(internshipEngagement)-[:mentor {active: true}]->(mentorUser)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMentor:ACL {canEditMentor: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCountryOfOrigin:ACL {canReadCountryOfOrigin: true})-[:toNode]->(internshipEngagement)-[:countryOfOrigin {active: true}]->(countryOfOrigin)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCountryOfOrigin:ACL {canEditCountryOfOrigin: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadPosition:ACL {canReadPosition: true})-[:toNode]->(internshipEngagement)-[:position {active: true}]->(position:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditPosition:ACL {canEditPosition: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadMethodologies:ACL {canReadMethodologies: true})-[:toNode]->(internshipEngagement)-[:methodologies {active: true}]->(methodologies:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditMethodologies:ACL {canEditMethodologies: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStatus:ACL {canReadStatus: true})-[:toNode]->(internshipEngagement)-[:status {active: true}]->(status:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditStatus:ACL {canEditStatus: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCompleteDate:ACL {canReadCompleteDate: true})-[:toNode]->(internshipEngagement)-[:completeDate {active: true}]->(completeDate:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCompleteDate:ACL {canEditCompleteDate: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(CanReadDisbursementCompleteDate:ACL {CanReadDisbursementCompleteDate: true})-[:toNode]->(internshipEngagement)-[:disbursementCompleteDate {active: true}]->(disbursementCompleteDate:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(CanEditDisbursementCompleteDate:ACL {CanEditDisbursementCompleteDate: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadCommunicationsCompleteDate:ACL {canReadCommunicationsCompleteDate: true})-[:toNode]->(internshipEngagement)-[:communicationsCompleteDate {active: true}]->(communicationsCompleteDate:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditCommunicationsCompleteDate:ACL {canEditCommunicationsCompleteDate: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStartDate:ACL {canReadStartDate: true})-[:toNode]->(internshipEngagement)-[:startDate {active: true}]->(startDate:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditStartDate:ACL {canEditStartDate: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadEndDate:ACL {canReadEndDate: true})-[:toNode]->(internshipEngagement)-[:endDate {active: true}]->(endDate:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditEndDate:ACL {canEditEndDate: true})-[:toNode]->(internshipEngagement)

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadInitialEndDate:ACL {canReadInitialEndDate: true})-[:toNode]->(internshipEngagement)-[:initialEndDate {active: true}]->(initialEndDate:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLastSuspendedAt:ACL {canReadLastSuspendedAt: true})-[:toNode]->(internshipEngagement)-[:lastSuspendedAt {active: true}]->(lastSuspendedAt:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadLastReactivatedAt:ACL {canReadLastReactivatedAt: true})-[:toNode]->(internshipEngagement)-[:lastReactivatedAt {active: true}]->(lastReactivatedAt:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadStatusModifiedAt:ACL {canReadStatusModifiedAt: true})-[:toNode]->(internshipEngagement)-[:statusModifiedAt {active: true}]->(statusModifiedAt:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadModifiedAt:ACL {canReadModifiedAt: true})-[:toNode]->(internshipEngagement)-[:modifiedAt {active: true}]->(modifiedAt:Property {active: true})

        RETURN
          internshipEngagement.id as id,
          internshipEngagement.createdAt as createdAt,
          project as project,
          ceremony.id as ceremonyId,
          internUser.id as internUserId,
          mentorUser.id as mentorUserId,
          countryOfOrigin.id as countryOfOriginId,
          position.value as position,
          methodologies.value as methodologies,
          status.value as status,
          completeDate.value as completeDate,
          disbursementCompleteDate.value as disbursementCompleteDate,
          communicationsCompleteDate.value as communicationsCompleteDate,
          startDate.value as startDate,
          endDate.value as endDate,
          initialEndDate.value as initialEndDate,
          lastSuspendedAt.value as lastSuspendedAt,
          lastReactivatedAt.value as lastReactivatedAt,
          statusModifiedAt.value as statusModifiedAt,
          modifiedAt.value as modifiedAt,
          canReadProject.canReadProject as canReadProject,
          canEditProject.canEditProject as canEditProject,
          canReadCeremony.canReadCeremony as canReadCeremony,
          canEditCeremony.canEditCeremony as canEditCeremony,
          canReadIntern.canReadIntern as canReadIntern,
          canEditIntern.canEditIntern as canEditIntern,
          canReadMentor.canReadMentor as canReadMentor,
          canEditMentor.canEditMentor as canEditMentor,
          canReadCountryOfOrigin.canReadCountryOfOrigin as canReadCountryOfOrigin,
          canEditCountryOfOrigin.canEditCountryOfOrigin as canEditCountryOfOrigin,
          canReadPosition.canReadPosition as canReadPosition,
          canEditPosition.canEditPosition as canEditPosition,
          canReadMethodologies.canReadMethodologies as canReadMethodologies,
          canEditMethodologies.canEditMethodologies as canEditMethodologies,
          canReadStatus.canReadStatus as canReadStatus,
          canEditStatus.canEditStatus as canEditStatus,
          canReadCompleteDate.canReadCompleteDate as canReadCompleteDate,
          canEditCompleteDate.canEditCompleteDate as canEditCompleteDate,
          CanReadDisbursementCompleteDate.CanReadDisbursementCompleteDate as CanReadDisbursementCompleteDate,
          CanEditDisbursementCompleteDate.CanEditDisbursementCompleteDate as CanEditDisbursementCompleteDate,
          canReadCommunicationsCompleteDate.canReadCommunicationsCompleteDate as canReadCommunicationsCompleteDate,
          canEditCommunicationsCompleteDate.canEditCommunicationsCompleteDate as canEditCommunicationsCompleteDate,
          canReadStartDate.canReadStartDate as canReadStartDate,
          canEditStartDate.canEditStartDate as canEditStartDate,
          canReadEndDate.canReadEndDate as canReadEndDate,
          canEditEndDate.canEditEndDate as canEditEndDate,
          canReadInitialEndDate.canReadInitialEndDate as canReadInitialEndDate,
          canReadLastSuspendedAt.canReadLastSuspendedAt as canReadLastSuspendedAt,
          canReadLastReactivatedAt.canReadLastReactivatedAt as canReadLastReactivatedAt,
          canReadStatusModifiedAt.canReadStatusModifiedAt as canReadStatusModifiedAt,
          canReadModifiedAt.canReadModifiedAt as canReadModifiedAt
      `;
    }

    const result = await this.db
      .query()
      .raw(query, {
        token: session.token,
        requestingUserId: session.userId,
        owningOrgId: session.owningOrgId,
        id,
      })
      .first();

    if (!result) {
      throw new NotFoundException(
        'Could not find language engagement or internship engagement'
      );
    }

    const ceremony = await this.ceremonyService.readOne(
      result.ceremonyId,
      session
    );

    const language = result.languageId
      ? await this.languageService.readOne(result.languageId, session)
      : undefined;

    const internUser = result.internUserId
      ? await this.userService.readOne(result.internUserId, session)
      : undefined;

    const mentorUser = result.mentorUserId
      ? await this.userService.readOne(result.mentorUserId, session)
      : undefined;

    const countryOfOrigin = result.countryOfOriginId
      ? await this.locationService.readOneCountry(
          result.countryOfOriginId,
          session
        )
      : undefined;

    const LanguageEngagement = {
      language: {
        value: language,
        canRead: !!result.canReadLanguage,
        canEdit: !!result.canEditLanguage,
      },
      firstScripture: {
        value: result.firstScripture,
        canRead: !!result.canReadFirstScripture,
        canEdit: !!result.canEditFirstScripture,
      },
      lukePartnership: {
        value: result.lukePartnership,
        canRead: !!result.canReadLukePartnership,
        canEdit: !!result.canEditLukePartnership,
      },
      sentPrintingDate: {
        value: result.sentPrintingDate,
        canRead: !!result.canReadSentPrintingDate,
        canEdit: !!result.canEditSentPrintingDate,
      },
    };

    const internshipEngagement = {
      position: {
        value: result.position,
        canRead: !!result.canReadPosition,
        canEdit: !!result.canEditPosition,
      },
      methodologies: {
        value: result.methodologies,
        canRead: !!result.canReadMethodologies,
        canEdit: !!result.canEditMethodologies,
      },
      intern: {
        value: internUser,
        canRead: !!result.canReadIntern,
        canEdit: !!result.canEditIntern,
      },
      mentor: {
        value: mentorUser,
        canRead: !!result.canReadMentor,
        canEdit: !!result.canEditMentor,
      },
      countryOfOrigin: {
        value: countryOfOrigin,
        canRead: !!result.canReadCountryOfOrigin,
        canEdit: !!result.canEditCountryOfOrigin,
      },
    };

    return {
      id,
      createdAt: result.createdAt,
      ...(label === 'LanguageEngagement'
        ? LanguageEngagement
        : internshipEngagement),
      status: result.status,
      ceremony: {
        value: {
          ...ceremony,
        },
        canRead: !!result.canReadCeremony,
        canEdit: !!result.canEditCeremony,
      },
      completeDate: {
        value: result.completeDate,
        canRead: !!result.canReadCompleteDate,
        canEdit: !!result.canEditCompleteDate,
      },
      disbursementCompleteDate: {
        value: result.disbursementCompleteDate,
        canRead: !!result.CanReadDisbursementCompleteDate,
        canEdit: !!result.CanEditDisbursementCompleteDate,
      },
      communicationsCompleteDate: {
        value: result.communicationsCompleteDate,
        canRead: !!result.canReadCommunicationsCompleteDate,
        canEdit: !!result.canEditCommunicationsCompleteDate,
      },
      modifiedAt: result.modifiedAt,
      startDate: {
        value: result.startDate,
        canRead: !!result.canReadStartDate,
        canEdit: !!result.canEditStartDate,
      },
      endDate: {
        value: result.endDate,
        canRead: !!result.canReadEndDate,
        canEdit: !!result.canEditEndDate,
      },
      initialEndDate: {
        value: result.initialEndDate,
        canRead: !!result.canReadInitialEndDate,
        canEdit: !!result.canEditInitialEndDate,
      },
      lastSuspendedAt: {
        value: result.lastSuspendedAt,
        canRead: !!result.canReadLastSuspendedAt,
        canEdit: !!result.canEditLastSuspendedAt,
      },
      lastReactivatedAt: {
        value: result.lastReactivatedAt,
        canRead: !!result.canReadLastReactivatedAt,
        canEdit: !!result.canEditLastReactivatedAt,
      },
      statusModifiedAt: {
        value: result.statusModifiedAt,
        canRead: !!result.canReadStatusModifiedAt,
        canEdit: !!result.canEditStatusModifiedAt,
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: EngagementListInput,
    session: ISession
  ): Promise<EngagementListOutput> {
    const matchNode =
      filter.type === 'internship'
        ? 'internship:InternshipEngagement'
        : filter.type === 'language'
        ? 'language:LanguageEngagement'
        : 'engagement';

    const tmpNode = matchNode.substring(0, matchNode.indexOf(':'));
    const node = tmpNode ? tmpNode : 'engagement';

    const query = `
      MATCH (${matchNode} {active: true})<-[:engagement {active: true}]-(project)
      RETURN ${node}.id as id
      ORDER BY ${node}.${sort} ${order}
      SKIP $skip LIMIT $count
    `;
    const result = await this.db
      .query()
      .raw(query, {
        skip: (page - 1) * count,
        count,
        type: filter.type,
      })
      .run();

    const items = await Promise.all(
      result.map((row) => this.readOne(row.id, session))
    );

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
    session: ISession
  ): Promise<SecuredProductList> {
    const result = await this.products.list(
      {
        ...input,
        filter: {
          ...input.filter,
          engagementId: engagement.id,
        },
      },
      session
    );

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }

  async createLanguageEngagement(
    { languageId, projectId, ...input }: CreateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    this.logger.info('Mutation create language engagement ', {
      input,
      projectId,
      languageId,
      userId: session.userId,
    });
    try {
      // Initial LanguageEngagement
      const id = generate();
      const acls = {
        canReadLanguage: true,
        canEditLanguage: true,
        canReadProject: true,
        canEditProject: true,
        canReadProduct: true,
        canEditProduct: true,
        canReadFirstScripture: true,
        canEditFirstScripture: true,
        canReadLukePartnership: true,
        canEditLukePartnership: true,
        canReadSentPrintingDate: true,
        canEditSentPrintingDate: true,
        canReadStatus: true,
        canEditStatus: true,
        canReadCeremony: true,
        canEditCeremony: true,
        canReadCompleteDate: true,
        canEditCompleteDate: true,
        canReadDisbursementCompleteDate: true,
        canEditDisbursementCompleteDate: true,
        canReadCommunicationsCompleteDate: true,
        canEditCommunicationsCompleteDate: true,
        canReadStartDate: true,
        canEditStartDate: true,
        canReadEndDate: true,
        canEditEndDate: true,
        canReadInitialEndDate: true,
        canReadLastSuspendedAt: true,
        canReadLastReactivatedAt: true,
        canReadStatusModifiedAt: true,
        canReadModifiedAt: true,
      };

      const ceremony = await this.ceremonyService.create(
        { type: CeremonyType.Dedication },
        session
      );

      await this.db.createNode({
        type: LanguageEngagement.classType,
        session,
        input: {
          id,
          ...input,
        },
        acls,
        aclEditProp: 'canCreateEngagement',
      });

      // connect Language and Project to LanguageEngagement.
      const query = `
        MATCH
          (project:Project {id: $projectId, active: true}),
          (language:Language {id: $languageId, active: true}),
          (ceremony:Ceremony {id: $ceremonyId, active: true}),
          (languageEngagement:LanguageEngagement {id: $id, active: true})
        CREATE
          (project)-[:engagement {active:true, createAt: datetime()}]->(languageEngagement),
          (languageEngagement)-[:language {active: true, createAt: datetime()}]->(language),
          (languageEngagement)-[:ceremony {active: true, createAt: datetime()}]->(ceremony)
        RETURN languageEngagement.id as id
      `;
      await this.db
        .query()
        .raw(query, {
          languageId: languageId,
          projectId: projectId,
          ceremonyId: ceremony.id,
          id: id,
        })
        .first();

      const res = (await this.readOne(id, session)) as LanguageEngagement;
      return res;
    } catch (e) {
      this.logger.error('Failed to create language engagement', {
        exception: e,
      });
      throw new Error(`Could not create LanguageEngagement`);
    }
  }

  async createInternshipEngagement(
    {
      projectId,
      internId,
      mentorId,
      countryOfOriginId,
      ...input
    }: CreateInternshipEngagement,
    session: ISession
  ): Promise<InternshipEngagement> {
    this.logger.info('Mutation create internship engagement ', {
      input,
      projectId,
      mentorId,
      countryOfOriginId,
      userId: session.userId,
    });
    const id = generate();
    const acls = {
      canReadIntern: true,
      canEditIntern: true,
      canReadMentor: true,
      canEditMentor: true,
      canReadCountryOfOrigin: true,
      canEditCountryOfOrigin: true,
      canReadPosition: true,
      canEditPosition: true,
      canReadMethodologies: true,
      canEditMethodologies: true,
      canReadProject: true,
      canEditProject: true,
      canReadCeremony: true,
      canEditCeremony: true,
      canReadCompleteDate: true,
      canEditCompleteDate: true,
      canReadDisbursementCompleteDate: true,
      canEditDisbursementCompleteDate: true,
      canReadCommunicationsCompleteDate: true,
      canEditCommunicationsCompleteDate: true,
      canReadStartDate: true,
      canEditStartDate: true,
      canReadEndDate: true,
      canEditEndDate: true,
      canReadInitialEndDate: true,
      canReadLastSuspendedAt: true,
      canReadLastReactivatedAt: true,
      canReadStatusModifiedAt: true,
      canReadModifiedAt: true,
    };

    try {
      const ceremony = await this.ceremonyService.create(
        { type: CeremonyType.Certification },
        session
      );
      await this.db.createNode({
        type: InternshipEngagement.classType,
        session: session,
        input: { id, ...input },
        acls,
        aclEditProp: 'canCreateEngagement',
      });

      const countryCond = `${
        typeof countryOfOriginId !== 'undefined'
          ? ',(countryOfOrigin:Country {id: $countryOfOriginId, active: true})'
          : ''
      }`;
      const mentorCond = `${
        typeof mentorId !== 'undefined'
          ? ',(mentorUser:User {id: $mentorId, active: true})'
          : ''
      }`;
      const countryRel = `${
        typeof countryOfOriginId !== 'undefined'
          ? ',(internshipEngagement)-[:countryOfOrigin {active: true, createdAt: datetime()}]->(countryOfOrigin)'
          : ''
      }`;
      const mentorRel = `${
        typeof mentorId !== 'undefined'
          ? ',(internshipEngagement)-[:mentor {active: true, createdAt: datetime()}]->(mentorUser)'
          : ''
      }`;
      const query = `
        MATCH
          (project:Project {id: $projectId, active: true})
          ,(internshipEngagement:InternshipEngagement {id: $id, active: true})
          ,(ceremony:Ceremony {id: $ceremonyId, active:true})
          ,(internUser:User {id: $internId, active: true})
          ${countryCond}${mentorCond}
        CREATE
          (internshipEngagement)<-[:engagement {active: true, createdAt: datetime()}]-(project)
          ,(internshipEngagement)-[:ceremony {active: true, createdAt: datetime()}]->(ceremony)
          ,(internshipEngagement)-[:intern {active: true, createdAt: datetime()}]->(internUser)
          ${countryRel}${mentorRel}
        RETURN
          internshipEngagement.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          id,
          projectId: projectId,
          internId: internId,
          mentorId: mentorId,
          countryOfOriginId: countryOfOriginId,
          ceremonyId: ceremony.id,
        })
        .first();

      return (await this.readOne(id, session)) as InternshipEngagement;
    } catch (e) {
      this.logger.error(e);
      throw new Error(`Could not create InternshipEngagement`);
    }
  }

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    try {
      const object = await this.readOne(input.id, session);
      await this.db.updateProperties({
        session,
        object,
        props: [
          'firstScripture',
          'lukePartnership',
          'completeDate',
          'disbursementCompleteDate',
          'communicationsCompleteDate',
          'startDate',
          'endDate',
        ],
        changes: {
          ...input,
        },
        nodevar: 'LanguageEngagement',
      });

      return (await this.readOne(input.id, session)) as LanguageEngagement;
    } catch (e) {
      this.logger.error(e);
      throw new Error('Could not update LanguageEngagement');
    }
  }

  async updateInternshipEngagement(
    { mentorId, countryOfOriginId, ...input }: UpdateInternshipEngagement,
    session: ISession
  ): Promise<InternshipEngagement> {
    try {
      if (mentorId) {
        const query = `
          MATCh
            (token:Token {
              active: true,
              value: $token
            })
              <-[:token {active: true}]-
            (requestingUser:User {
              active: true,
              id: $requestingUserId,
              owningOrgId: $owningOrgId
            }),
            (newMentorUser:User {active: true, id: $mentorId}),
            (internshipEngagement:InternshipEngagement {active: true, id: $id})-[rel:mentor {active: true}]->(oldMentorUser:User)
          DELETE rel
          CREATE (internshipEngagement)-[:mentor {active: true, createdAt: datetime()}]->(newMentorUser)
          RETURN internshipEngagement.id as id
        `;
        await this.db
          .query()
          .raw(query, {
            id: input.id,
            owningOrgId: session.owningOrgId,
            requestingUserId: session.userId,
            token: session.token,
            mentorId: mentorId,
          })
          .first();
      }

      if (countryOfOriginId) {
        const query = `
          MATCh
            (token:Token {
              active: true,
              value: $token
            })
              <-[:token {active: true}]-
            (requestingUser:User {
              active: true,
              id: $requestingUserId,
              owningOrgId: $owningOrgId
            }),
            (newCountry:Country {active: true, id: $countryOfOriginId}),
            (internshipEngagement:InternshipEngagement {active: true, id: $id})-[rel:countryOfOrigin {active: true}]->(oldCountry:Country)
          DELETE rel
          CREATE (internshipEngagement)-[:countryOfOrigin {active: true, createdAt: datetime()}]->(newCountry)
          RETURN internshipEngagement.id as id
        `;
        await this.db
          .query()
          .raw(query, {
            id: input.id,
            owningOrgId: session.owningOrgId,
            requestingUserId: session.userId,
            token: session.token,
            countryOfOriginId: countryOfOriginId,
          })
          .first();
      }

      const object = await this.readOne(input.id, session);
      await this.db.updateProperties({
        session,
        object,
        props: [
          'position',
          'methodologies',
          'completeDate',
          'disbursementCompleteDate',
          'communicationsCompleteDate',
          'startDate',
          'endDate',
        ],
        changes: {
          ...input,
        },
        nodevar: 'InternshipEngagement',
      });

      return (await this.readOne(input.id, session)) as InternshipEngagement;
    } catch (e) {
      this.logger.error(e);
      throw new Error('Could not update LanguageEngagement');
    }
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find engagement');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete partnership', {
        exception: e,
      });

      throw e;
    }
  }
}
