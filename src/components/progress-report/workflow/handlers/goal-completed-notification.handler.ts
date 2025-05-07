import { entries, mapEntries } from '@seedcompany/common';
import { EmailService } from '@seedcompany/nestjs-email';
import type { RequireExactlyOne } from 'type-fest';
import { type ID, Role } from '~/common';
import {
  ConfigService,
  EventsHandler,
  type IEventHandler,
  ILogger,
  Logger,
  ResourceLoader,
} from '~/core';
import {
  type GoalCompletedProps as EmailGoalCompletedNotification,
  GoalCompleted,
} from '~/core/email/templates/product-consultant-checked.template';
import { EngagementService } from '../../../../components/engagement';
import { ProductService } from '../../../../components/product';
import { type ProgressVariantByReportOutput } from '../../../../components/product-progress/dto';
import { ProductProgressByReportLoader } from '../../../../components/product-progress/product-progress-by-report.loader';
import { ProductListInput } from '../../../../components/product/dto';
import { AuthenticationService } from '../../../authentication';
import { LanguageService } from '../../../language';
import { UserService } from '../../../user';
import { type ProgressReportStatus as Status } from '../../dto';
import { WorkflowUpdatedEvent } from '../events/workflow-updated.event';
import { ProgressReportWorkflowRepository } from '../progress-report-workflow.repository';
import { type InternalTransition } from '../transitions';

const rolesToAlwaysNotify = [
  Role.ProjectManager,
  Role.RegionalDirector,
  Role.FieldOperationsDirector,
];

@EventsHandler(WorkflowUpdatedEvent)
export class ProgressReportWorkflowNotificationHandler
  implements IEventHandler<WorkflowUpdatedEvent>
{
  constructor(
    private readonly auth: AuthenticationService,
    private readonly repo: ProgressReportWorkflowRepository,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly engagementService: EngagementService,
    private readonly languageService: LanguageService,
    private readonly productService: ProductService,
    private readonly productProgressByReportLoader: ProductProgressByReportLoader,
    private readonly emailService: EmailService,
    private readonly resources: ResourceLoader,
    @Logger('progress-report:status-change-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle({
    reportId,
    previousStatus,
    next,
    session,
  }: WorkflowUpdatedEvent) {
    if (next !== 'Approved' || previousStatus !== 'InReview') {
      return;
    }

    const { languageId } = await this.repo.getProjectInfoByReportId(reportId);

    const progressReport = await this.resources.load(
      'ProgressReport',
      reportId,
    );

    const engagementId = progressReport.parent.properties.id;
    const productList = await this.productService.list(
      ProductListInput.defaultValue(ProductListInput, {
        filter: { engagementId },
      }),
      session,
    );

    const variants = [
      { key: 'official', label: 'Official' },
      { key: 'partner', label: 'Partner' },
    ] as const;

    const productInputs = productList.items.flatMap((product) =>
      variants.map((variant) => ({
        report: progressReport,
        product,
        variant,
      })),
    );

    const products = await this.productProgressByReportLoader.loadMany(
      productInputs,
    );

    const completed = products.filter((product) =>
      product.details.some((detail) =>
        detail.steps.some(
          (step) =>
            step.step === 'ConsultantCheck' && step.completed?.value === 100,
        ),
      ),
    );

    const userIdByEmail = mapEntries(
      [
        ...(await this.getEnvNotifyees(next)),
        ...(await this.getProjectNotifyees(reportId, next)),
      ],
      ({ id, email }) => [email, id],
    ).asMap;

    const notifications = await Promise.all(
      entries(userIdByEmail).map(([email, userId]) =>
        this.prepareNotificationObject(
          userId ? { userId } : { email },
          progressReport.parent.properties.id,
          languageId,
          completed,
        ),
      ),
    );

    this.logger.info('Notifying', {
      emails: notifications.map((r) => r.recipient.email.value),
      engagement: notifications[0]?.engagement.id ?? undefined,
      languageId: notifications[0]?.language.id ?? undefined,
      products: notifications[0]?.products.map((p) => p.id ?? []),
    });

    for (const notification of notifications) {
      if (notification.recipient.email.value) {
        await this.emailService.send(
          notification.recipient.email.value,
          GoalCompleted,
          notification,
        );
      }
    }
  }

  private async prepareNotificationObject(
    receiver: RequireExactlyOne<{ userId: ID; email: string }>,
    engagementId: ID,
    languageId: ID,
    products: ProgressVariantByReportOutput[],
  ): Promise<EmailGoalCompletedNotification> {
    const recipientId = receiver.userId ?? this.configService.rootUser.id;
    const recipientSession = await this.auth.sessionForUser(recipientId);

    const recipient = await this.userService.readOne(
      recipientId,
      recipientSession,
    );

    const language = await this.languageService.readOne(
      languageId,
      recipientSession,
    );

    const engagement = await this.engagementService.readOne(
      engagementId,
      recipientSession,
    );

    const productDetails =
      await this.productService.loadProductIdsWithProducibleNames(engagementId); //.listIdsAndScriptureRefs(progressReport.parent.properties.id)

    const productIds = new Set(
      products.flatMap((product) =>
        product.details.map((detail) => detail.productId),
      ),
    );

    const filteredProductDetails = Array.from(productDetails.values())
      .filter((id) => productIds.has(id))
      .map(([id, name]) => ({
        id,
        name,
      }));

    return {
      recipient,
      language,
      engagement,
      products: filteredProductDetails,
    } satisfies EmailGoalCompletedNotification;
  }

  private async getEnvNotifyees(next: Status | InternalTransition) {
    const { forTransitions, forBypasses } =
      this.configService.progressReportStatusChange.notifyExtraEmails;
    const envEmailList =
      typeof next !== 'string'
        ? forTransitions.get(next.name)
        : forBypasses.get(next);
    return [
      ...(envEmailList?.map((email) => ({ id: undefined, email })) ?? []),
      ...(envEmailList ? await this.repo.getUserIdByEmails(envEmailList) : []),
    ];
  }

  private async getProjectNotifyees(
    reportId: ID,
    next: Status | InternalTransition,
  ) {
    const roles = [
      ...rolesToAlwaysNotify,
      ...(typeof next !== 'string' ? next.notify?.membersWithRoles ?? [] : []),
    ];

    const members = await this.repo.getProjectMemberInfoByReportId(reportId);
    return members.filter((mbr) =>
      mbr.roles.some((role) => roles.includes(role)),
    );
  }
}
