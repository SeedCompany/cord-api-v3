import { ConditionalKeys } from 'type-fest';
import { Secured } from '../../../common';
import { Budget, BudgetRecord } from '../../budget';
import { Ceremony } from '../../ceremony';
import { InternshipEngagement, LanguageEngagement } from '../../engagement';
import { Directory, File, FileVersion } from '../../file';
import { Film } from '../../film';
import { FundingAccount } from '../../funding-account';
import { EthnologueLanguage, Language } from '../../language';
import { LiteracyMaterial } from '../../literacy-material';
import { Country, Region, Zone } from '../../location';
import { Organization } from '../../organization';
import { Partner } from '../../partner';
import { Partnership } from '../../partnership';
import { Product } from '../../product';
import { Project, ProjectMember } from '../../project';
import { Song } from '../../song';
import { Story } from '../../story';
import { Education, Unavailability } from '../../user';
import { User } from '../../user/dto';

export interface TypeToDto {
  Budget: Budget;
  BudgetRecord: BudgetRecord;
  Ceremony: Ceremony;
  Country: Country;
  Directory: Directory;
  Education: Education;
  EthnologueLanguage: EthnologueLanguage;
  File: File;
  FileVersion: FileVersion;
  Film: Film;
  FundingAccount: FundingAccount;
  Language: Language;
  LanguageEngagement: LanguageEngagement;
  LiteracyMaterial: LiteracyMaterial;
  InternshipEngagement: InternshipEngagement;
  Organization: Organization;
  Partner: Partner;
  Partnership: Partnership;
  Product: Product;
  Project: Project;
  ProjectMember: ProjectMember;
  Region: Region;
  Song: Song;
  Story: Story;
  Unavailability: Unavailability;
  User: User;
  Zone: Zone;
  // Add more here as needed
}

type SecuredKeys<Dto extends Record<string, any>> = ConditionalKeys<
  Dto,
  Secured<any>
>;

export interface TypeToSecuredProps {
  Project:
    | SecuredKeys<Project>
    | 'rootDirectory'
    | 'member'
    | 'locations'
    | 'partnership'
    | 'budget';
  ProjectMember: SecuredKeys<ProjectMember>;
  User: SecuredKeys<User>;
  // Add more here as needed
}
