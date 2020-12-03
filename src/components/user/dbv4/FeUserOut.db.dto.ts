import { GenericOut } from '../../../core/database/v4/dto/GenericOut';
import { User } from '../dto';

export class FeUserOut extends GenericOut {
  user: User;
}
