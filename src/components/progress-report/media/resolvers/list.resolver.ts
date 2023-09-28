import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session, Variant } from '~/common';
import { Privileges, withVariant } from '../../../authorization';
import {
  AvailableProgressReportMediaVariant as AvailableVariant,
  ProgressReportMedia as ReportMedia,
  ProgressReportMediaList as ReportMediaList,
} from '../dto';

@Resolver(ReportMediaList)
export class ProgressReportMediaListResolver {
  constructor(private readonly privileges: Privileges) {}

  @ResolveField(() => [Variant], {
    description: 'The variants the requester has access to upload',
    deprecationReason: 'Use `availableVariants` instead',
  })
  uploadableVariants(
    @Parent() { report }: ReportMediaList,
    @AnonSession() session: Session,
  ): ReadonlyArray<ReportMedia['variant']> {
    const context = report as any; // the report is fine for condition context
    const privileges = this.privileges.for(session, ReportMedia);
    return ReportMedia.Variants.filter((variant) =>
      privileges.forContext(withVariant(context, variant)).can('create'),
    );
  }

  @ResolveField(() => [AvailableVariant], {
    description: 'The variants available to the requester',
  })
  availableVariants(
    @Parent() { report }: ReportMediaList,
    @AnonSession() session: Session,
  ): readonly AvailableVariant[] {
    const context = report as any; // the report is fine for condition context
    const privileges = this.privileges.for(session, ReportMedia);
    return ReportMedia.Variants.filter((variant) =>
      privileges.forContext(withVariant(context, variant)).can('read'),
    ).map(
      (variant): AvailableVariant => ({
        variant,
        canCreate: privileges
          .forContext(withVariant(context, variant))
          .can('create'),
      }),
    );
  }
}
