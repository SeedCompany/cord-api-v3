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
  Budget: SecuredKeys<Budget> | 'status' | 'records';
  BudgetRecord: SecuredKeys<BudgetRecord>;
  Ceremony: SecuredKeys<Ceremony> | 'type';
  Country: SecuredKeys<Country>;
  Directory:
    | SecuredKeys<Directory>
    | 'name'
    | 'type'
    | 'createdBy'
    | 'parent'
    | 'description';
  Education: SecuredKeys<Education>;
  EthnologueLanguage: SecuredKeys<EthnologueLanguage>;
  File: SecuredKeys<File>;
  FileVersion: SecuredKeys<FileVersion>;
  Film: SecuredKeys<Film>;
  FundingAccount: SecuredKeys<FundingAccount>;
  Language: SecuredKeys<Language>;
  LanguageEngagement: SecuredKeys<LanguageEngagement>;
  LiteracyMaterial: SecuredKeys<LiteracyMaterial>;
  InternshipEngagement: SecuredKeys<InternshipEngagement>;
  Organization: SecuredKeys<Organization>;
  Partner: SecuredKeys<Partner>;
  Partnership: SecuredKeys<Partnership>;
  Product: SecuredKeys<Product>;

  Project:
    | SecuredKeys<Project>
    | 'status'
    | 'modifiedAt'
    | 'rootDirectory'
    | 'member'
    | 'locations'
    | 'partnership'
    | 'budget';
  ProjectMember: SecuredKeys<ProjectMember> | 'modifiedAt';
  Region: SecuredKeys<Region>;
  Song: SecuredKeys<Song>;
  Story: SecuredKeys<Story>;
  Unavailability: SecuredKeys<Unavailability>;
  User: SecuredKeys<User>;
  Zone: SecuredKeys<Zone>;
  // Add more here as needed
}
