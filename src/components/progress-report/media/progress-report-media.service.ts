import { Injectable } from '@nestjs/common';
import { IdOf, NotImplementedException, Session } from '~/common';
import { ProgressReport as Report } from '../dto';
import {
  ProgressReportMedia as ReportMedia,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from './media.dto';

@Injectable()
export class ProgressReportMediaService {
  async listForReport(
    report: Report,
    session: Session,
  ): Promise<readonly ReportMedia[]> {
    throw new NotImplementedException().with(report, session);
  }

  async listOfRelated(
    media: ReportMedia,
    session: Session,
  ): Promise<readonly ReportMedia[]> {
    throw new NotImplementedException().with(media, session);
  }

  async upload(input: UploadMedia, session: Session) {
    throw new NotImplementedException().with(input, session);
  }

  async update(input: UpdateMedia, session: Session): Promise<ReportMedia> {
    throw new NotImplementedException().with(input, session);
  }

  async delete(id: IdOf<ReportMedia>, session: Session): Promise<IdOf<Report>> {
    throw new NotImplementedException().with(id, session);
  }
}
