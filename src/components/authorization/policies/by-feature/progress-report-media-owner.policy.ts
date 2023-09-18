import { owner, Policy } from '../util';

@Policy('all', (r) => r.ProgressReportMedia.when(owner).edit.delete)
export class ProgressReportMediaOwnerPolicy {}
