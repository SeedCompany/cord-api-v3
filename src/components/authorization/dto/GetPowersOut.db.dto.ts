import { GenericOut } from '../../../core/database/v4/dto/GenericOut';
import { Powers } from './powers';

export class GetPowersOut extends GenericOut {
  powers: Powers[];
}
