import { ModuleRef } from '@nestjs/core';
import {
  asNonEmptyArray,
  groupBy,
  type NonEmptyArray,
  setOf,
} from '@seedcompany/common';
import {
  Book,
  mergeVerseRanges,
  splitRangeByBook,
  type Verse,
} from '@seedcompany/scripture';
import { type ComponentProps as PropsOf } from 'react';
import { type ID, type Range } from '~/common';
import { ConfigService, ILogger, Logger, ResourceLoader } from '~/core';
import { Identity } from '~/core/authentication';
import { MailerService } from '~/core/email';
import { OnHook } from '~/core/hooks';
import {
  type ProgressReport,
  ProgressReportStatus as Status,
} from '../../../components/progress-report/dto';
import { WorkflowUpdatedHook } from '../../../components/progress-report/workflow/hooks/workflow-updated.hook';
import { ProductService } from '../../product';
import { ProgressReportVariantProgress } from '../../product-progress/dto';
import { ProductProgressByReportLoader } from '../../product-progress/product-progress-by-report.loader';
import {
  asProductType,
  DirectScriptureProduct,
  ProductListInput,
  resolveProductType,
} from '../../product/dto';
import { ProjectMemberRepository } from '../../project/project-member/project-member.repository';
import { DBLUpload } from '../emails/dbl-upload.email';

@OnHook(WorkflowUpdatedHook)
export class DBLUploadNotificationHandler {
  constructor(
    private readonly identity: Identity,
    private readonly moduleRef: ModuleRef,
    private readonly resources: ResourceLoader,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    @Logger('progress-report:dbl-upload-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle({ reportId, previousStatus, next }: WorkflowUpdatedHook) {
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

    const report = await this.resources.load('ProgressReport', reportId);

    const completedProducts = await this.determineCompletedProducts(report);
    if (completedProducts.size === 0) {
      return;
    }

    const completedBooks = await this.determineCompletedBooks(
      report.parent.properties.id,
      completedProducts,
    );
    if (!completedBooks) {
      return;
    }

    await this.notifyProjectManagersOfUploadNeeded(report, completedBooks);
  }

  private async notifyProjectManagersOfUploadNeeded(
    report: ProgressReport,
    completedBooks: NonEmptyArray<Range<Verse>>,
  ) {
    const engagement = await this.resources.load(
      'LanguageEngagement',
      report.parent.properties.id,
    );
    const notifyees = await this.moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(engagement.project.id, ['ProjectManager']);

    const notifyeesProps = await Promise.all(
      notifyees
        .filter((n) => n.email)
        .map(({ id: userId }) =>
          this.gatherTemplateProps(
            userId,
            engagement.id,
            engagement.language.value!.id,
            engagement.project.id,
            completedBooks,
          ),
        ),
    );

    this.logger.info('Notifying', {
      engagement: notifyeesProps[0]?.engagement.id ?? undefined,
      reportId: report.id,
      reportDate: report.start,
      books: completedBooks.map((r) => r.start.book.name),
      emails: notifyeesProps.map((r) => r.recipient.email.value),
    });

    for (const props of notifyeesProps) {
      // members without an email address are already omitted
      const to = props.recipient.email.value!;
      await this.mailer
        .withOptions({ send: !!this.config.email.notifyDblUpload })
        .compose(
          {
            to,
            ...(this.config.email.notifyDblUpload?.replyTo && {
              'reply-to': this.config.email.notifyDblUpload.replyTo,
            }),
          },
          <DBLUpload {...props} />,
        )
        .send();
    }
  }

  private async determineCompletedProducts(report: ProgressReport) {
    const loader = await this.resources.getLoader(
      ProductProgressByReportLoader,
    );
    const { details: productProgress } = await loader.load({
      report,
      variant: ProgressReportVariantProgress.Variants.byKey('official'),
    });

    const completed = productProgress.flatMap(({ steps, productId }) => {
      const completed = steps.some(
        (step) =>
          step.step === 'ConsultantCheck' && step.completed?.value === 100,
      );
      return completed ? productId : [];
    });
    return setOf(completed);
  }

  private async determineCompletedBooks(
    engagementId: ID<'Engagement'>,
    completedProductIds: ReadonlySet<ID<'Product'>>,
  ) {
    const { items: products } = await this.moduleRef
      .get(ProductService, { strict: false })
      .list(
        ProductListInput.defaultValue(ProductListInput, {
          filter: { engagementId },
          count: 1_000, // no pagination
        }),
      );

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
    return asNonEmptyArray(completedBooks);
  }

  private async gatherTemplateProps(
    recipientId: ID<'User'>,
    engagementId: ID,
    languageId: ID,
    projectId: ID,
    completedBooks: NonEmptyArray<Range<Verse>>,
  ) {
    return await this.identity.asUser(recipientId, async () => {
      const [recipient, language, engagement, project] = await Promise.all([
        this.resources.load('User', recipientId),
        this.resources.load('Language', languageId),
        this.resources.load('Engagement', engagementId),
        this.resources.load('Project', projectId),
      ]);

      return {
        recipient,
        language,
        project,
        engagement,
        completedBooks,
        dblFormUrl: this.config.email.notifyDblUpload?.formUrl ?? '',
      } satisfies PropsOf<typeof DBLUpload>;
    });
  }
}
