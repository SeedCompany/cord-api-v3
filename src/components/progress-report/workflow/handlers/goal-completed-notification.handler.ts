import { ModuleRef } from '@nestjs/core';
import { groupBy, setOf } from '@seedcompany/common';
import { EmailService } from '@seedcompany/nestjs-email';
import {
  Book,
  mergeVerseRanges,
  splitRangeByBook,
  type Verse,
} from '@seedcompany/scripture';
import { type ID, type Range, Role } from '~/common';
import {
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
import { AuthenticationService } from '../../../authentication';
import { EngagementService } from '../../../engagement';
import { LanguageService } from '../../../language';
import { ProductService } from '../../../product';
import { ProgressReportVariantProgress } from '../../../product-progress/dto';
import { ProductProgressByReportLoader } from '../../../product-progress/product-progress-by-report.loader';
import {
  asProductType,
  DirectScriptureProduct,
  ProductListInput,
  resolveProductType,
} from '../../../product/dto';
import { ProjectService } from '../../../project';
import { UserService } from '../../../user';
import { ProgressReportStatus as Status } from '../../dto';
import { WorkflowUpdatedEvent } from '../events/workflow-updated.event';
import { ProgressReportWorkflowRepository } from '../progress-report-workflow.repository';

const projectMemberRolesToNotify = setOf<Role>([
  Role.ProjectManager,
  Role.RegionalDirector,
  Role.FieldOperationsDirector,
]);

@EventsHandler(WorkflowUpdatedEvent)
export class GoalCompletedNotificationHandler
  implements IEventHandler<WorkflowUpdatedEvent>
{
  constructor(
    private readonly auth: AuthenticationService,
    private readonly repo: ProgressReportWorkflowRepository,
    private readonly userService: UserService,
    private readonly languageService: LanguageService,
    private readonly moduleRef: ModuleRef,
    private readonly emailService: EmailService,
    private readonly resources: ResourceLoader,
    @Logger('progress-report:goal-completed-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle({
    reportId,
    previousStatus,
    next,
    session,
  }: WorkflowUpdatedEvent) {
    const nextStatus = typeof next === 'string' ? next : next.to;
    // Continue if the report is at least Approved, and wasn't before.
    if (
      !(
        Status.indexOf(nextStatus) >= Status.indexOf('Approved') &&
        Status.indexOf(previousStatus) < Status.indexOf('Approved')
      )
    ) {
      return;
    }

    const progressReport = await this.resources.load(
      'ProgressReport',
      reportId,
    );
    const productProgressByReportLoader = await this.resources.getLoader(
      ProductProgressByReportLoader,
    );
    const { details: productProgress } =
      await productProgressByReportLoader.load({
        report: progressReport,
        variant: ProgressReportVariantProgress.FallbackVariant,
      });

    const completedProductIds = setOf(
      productProgress.flatMap(({ steps, productId }) => {
        const completed = steps.some(
          (step) =>
            step.step === 'ConsultantCheck' && step.completed?.value === 100,
        );
        return completed ? productId : [];
      }),
    );

    if (completedProductIds.size === 0) {
      return;
    }

    const engagementId = progressReport.parent.properties.id;
    const [ids, { items: products }, notifyees] = await Promise.all([
      this.repo.getProjectInfoByReportId(reportId),
      this.moduleRef.get(ProductService, { strict: false }).list(
        ProductListInput.defaultValue(ProductListInput, {
          filter: { engagementId },
          count: 1_000, // no pagination
        }),
        session,
      ),
      this.getProjectNotifyees(reportId),
    ]);

    const completedProducts = products.flatMap((product) => {
      if (!completedProductIds.has(product.id)) {
        return [];
      }
      const type = resolveProductType(product);
      if (type !== DirectScriptureProduct) {
        return [];
      }
      const dsp = asProductType(DirectScriptureProduct)(product);
      if (dsp.scriptureReferences.value.length === 0) {
        return []; // sanity check shouldn't really happen
      }
      // TODO filter on methodology?
      return dsp;
    });

    const completedRanges = mergeVerseRanges([
      ...completedProducts.flatMap(
        (product) => product.scriptureReferences.value,
      ),
      // Aggregate unspecified scripture
      // and pull out completed books identified by matching the total verse count.
      ...groupBy(
        completedProducts.flatMap(
          (product) => product.unspecifiedScripture.value ?? [],
        ),
        (unknownRange) => unknownRange.book,
      ).flatMap((unknownRanges) => {
        const book = Book.named(unknownRanges[0].book);
        const totalDeclared = unknownRanges.reduce(
          (total, unknownRange) => total + unknownRange.totalVerses,
          0,
        );
        return book.totalVerses === totalDeclared ? book.full : [];
      }),
    ]);
    const completedBooks = completedRanges
      .flatMap(splitRangeByBook)
      .flatMap((range) => {
        const fullBook = range.start.book.full;
        return range.start.equals(fullBook.start) &&
          range.end.equals(fullBook.end)
          ? range
          : [];
      });

    if (completedBooks.length === 0) {
      return;
    }

    const notifications = await Promise.all(
      notifyees.map(({ id: userId }) =>
        this.prepareNotificationObject(
          userId,
          engagementId,
          ids.languageId,
          ids.projectId,
          completedBooks,
        ),
      ),
    );

    this.logger.info('Notifying', {
      engagement: notifications[0]?.engagement.id ?? undefined,
      reportId: progressReport.id,
      reportDate: progressReport.start,
      books: completedBooks.map((r) => r.start.book.name),
      emails: notifications.map((r) => r.recipient.email.value),
    });

    for (const notification of notifications) {
      await this.emailService.send(
        notification.recipient.email.value!, // members without an email address are already omitted
        GoalCompleted,
        notification,
        // TODO reply to Darcie
      );
    }
  }

  private async prepareNotificationObject(
    recipientId: ID<'User'>,
    engagementId: ID,
    languageId: ID,
    projectId: ID,
    completedBooks: ReadonlyArray<Range<Verse>>,
  ) {
    const recipientSession = await this.auth.sessionForUser(recipientId);

    const [recipient, language, engagement, project] = await Promise.all([
      this.userService.readOne(recipientId, recipientSession),
      this.languageService.readOne(languageId, recipientSession),
      this.moduleRef
        .get(EngagementService, { strict: false })
        .readOne(engagementId, recipientSession),
      this.moduleRef
        .get(ProjectService, { strict: false })
        .readOne(projectId, recipientSession),
    ]);

    return {
      recipient,
      language,
      project,
      engagement,
      completedBooks,
    } satisfies EmailGoalCompletedNotification;
  }

  private async getProjectNotifyees(reportId: ID) {
    const members = await this.repo.getProjectMemberInfoByReportId(reportId);
    return members.filter(({ roles }) =>
      roles.some((role) => projectMemberRolesToNotify.has(role)),
    );
  }
}
