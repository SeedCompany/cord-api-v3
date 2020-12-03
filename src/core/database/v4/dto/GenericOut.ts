import { ErrorCode } from './ErrorCode.enum';

export class GenericOut {
  success: boolean;
  message: string;
  error: ErrorCode;
}

export class CreateOut extends GenericOut {
  id: string;
}
