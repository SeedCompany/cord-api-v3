import { GenericOut } from '../../../core/database/v4/dto/GenericOut';
import { User } from '../dto';

export class ApiUserOut extends GenericOut {
  user: User;
}
