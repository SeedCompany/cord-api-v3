import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session, Variant } from '~/common';
import { Privileges, withVariant } from '../../../authorization';
import {
  ProgressReportMedia as ReportMedia,
  ProgressReportMediaList as ReportMediaList,
} from '../media.dto';

@Resolver(ReportMediaList)
export class ProgressReportMediaListResolver {
  constructor(private readonly privileges: Privileges) {}

  @ResolveField(() => [Variant], {
    description: 'The variants the requester has access to upload',
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
}
