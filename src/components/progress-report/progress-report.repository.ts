import { Injectable } from '@nestjs/common';
import { DtoRepository } from '~/core/database';
import { ProgressReport } from './dto';

@Injectable()
export class ProgressReportRepository extends DtoRepository(ProgressReport) {}
