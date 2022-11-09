import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Session } from '~/common';
import { oncePerProject, QueryFragment } from '~/core/database/query';
import { PromptVariantResponseRepository } from '../prompts/prompt-variant-response.repository';
import { ProgressReport } from './dto';
import { ProgressReportHighlight as Highlight } from './dto/hightlights.dto';

@Injectable()
export class ProgressReportHighlightsRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'highlights'],
  Highlight
) {
  protected filterToReadable(session: Session) {
    return this.privileges.forUser(session).filterToReadable({
      wrapContext: oncePerProjectFromProgressReportEdge,
    });
  }
}

export const oncePerProjectFromProgressReportEdge =
  (inner: QueryFragment): QueryFragment =>
  (query) =>
    query
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement'),
        node('', 'Engagement'),
        relation('out', '', 'report'),
        node('', 'ProgressReport'),
        relation('out', '', 'child'),
        node('node'),
      ])
      .apply(oncePerProject(inner));
