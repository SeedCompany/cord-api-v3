import { creator, Policy } from '../util';

@Policy('all', (r) => r.ProgressReportMedia.when(creator).edit.delete)
export class ProgressReportMediaOwnerPolicy {}
