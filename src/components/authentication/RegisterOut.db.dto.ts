import { GenericOut } from '../../core/database/v4/dto/GenericOut';
import { Powers } from '../authorization/dto/powers';
import { User } from '../user';

export class RegisterOut extends GenericOut {
  user: User;
  powers: Powers[];
}
