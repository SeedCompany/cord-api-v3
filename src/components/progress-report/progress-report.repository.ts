import { Injectable } from '@nestjs/common';
import { DtoRepository } from '~/core';
import { ProgressReport } from './dto';

@Injectable()
export class ProgressReportRepository extends DtoRepository(ProgressReport) {}
