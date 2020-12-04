import { DateTime } from 'luxon';
import { GenericOut } from '../../../core/database/v4/dto/GenericOut';

export class EmailTokenOut extends GenericOut {
  email: string;
  token: string;
  createdOn: DateTime;
}
