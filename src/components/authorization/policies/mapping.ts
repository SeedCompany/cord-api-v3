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
  Budget:
    | SecuredKeys<Budget>
    | 'status'
    | 'budget'
    | 'records'
    | 'universalTemplateFile'
    | 'organization';
  BudgetRecord:
    | SecuredKeys<BudgetRecord>
    | 'fiscalYear'
    | 'amount'
    | 'record'
    | 'partnership'
    | 'organization';
  Ceremony:
    | SecuredKeys<Ceremony>
    | 'planned'
    | 'actualDate'
    | 'estimatedDate'
    | 'type'
    | 'ceremony';
  Country: SecuredKeys<Country> | 'name';
  Directory:
    | SecuredKeys<Directory>
    | 'name'
    | 'createdBy'
    | 'parent'
    | 'rootDirectory';
  Education:
    | SecuredKeys<Education>
    | 'degree'
    | 'major'
    | 'institution'
    | 'education';
  EthnologueLanguage:
    | SecuredKeys<EthnologueLanguage>
    | 'code'
    | 'provisionalCode'
    | 'name'
    | 'population';
  File: SecuredKeys<File> | 'name' | 'createdBy' | 'parent' | 'mimeType';
  FileVersion:
    | SecuredKeys<FileVersion>
    | 'name'
    | 'category'
    | 'size'
    | 'mimeType'
    | 'createdBy'
    | 'parent';
  Film: SecuredKeys<Film> | 'name' | 'scriptureReferences' | 'produces';
  FundingAccount: SecuredKeys<FundingAccount> | 'name';
  Language:
    | SecuredKeys<Language>
    | 'name'
    | 'displayName'
    | 'sensitivity'
    | 'isDialect'
    | 'populationOverride'
    | 'registryOfDialectsCode'
    | 'leastOfThese'
    | 'leastOfTheseReason'
    | 'displayNamePronunciation'
    | 'isSignLanguage'
    | 'signLanguageCode'
    | 'sponsorEstimatedEndDate'
    | 'ethnologue';
  LanguageEngagement:
    | SecuredKeys<LanguageEngagement>
    | 'status'
    | 'completeDate'
    | 'disbursementCompleteDate'
    | 'communicationsCompleteDate'
    | 'initialEndDate'
    | 'startDate'
    | 'endDate'
    | 'startDateOverride'
    | 'endDateOverride'
    | 'updatedAt'
    | 'lastReactivatedAt'
    | 'lastSuspendedAt'
    | 'modifiedAt'
    | 'product'
    | 'ceremony'
    | 'language'
    | 'paraTextRegistryId'
    | 'projectEngagementTag'
    | 'ceremonyPlanned'
    | 'sentPrinting'
    | 'lukePartnership'
    | 'firstScripture';
  LiteracyMaterial:
    | SecuredKeys<LiteracyMaterial>
    | 'name'
    | 'scriptureReferences'
    | 'produces';
  InternshipEngagement:
    | SecuredKeys<InternshipEngagement>
    | 'status'
    | 'completeDate'
    | 'disbursementCompleteDate'
    | 'communicationsCompleteDate'
    | 'initialEndDate'
    | 'startDate'
    | 'endDate'
    | 'startDateOverride'
    | 'endDateOverride'
    | 'updatedAt'
    | 'lastReactivatedAt'
    | 'lastSuspendedAt'
    | 'modifiedAt'
    | 'position'
    | 'methodologies'
    | 'intern'
    | 'mentor'
    | 'ceremony'
    | 'countryOfOrigin'
    | 'language'
    | 'growthPlan';
  Organization:
    | SecuredKeys<Organization>
    | 'name'
    | 'organization'
    | 'organizations';
  Partner:
    | SecuredKeys<Partner>
    | 'pointOfContact'
    | 'organization'
    | 'type'
    | 'financialReportingType';
  Partnership:
    | SecuredKeys<Partnership>
    | 'mou'
    | 'agreement'
    | 'agreementStatus'
    | 'mouStatus'
    | 'mouStart'
    | 'mouEnd'
    | 'mouStartOverride'
    | 'mouEndOverride'
    | 'types'
    | 'comment'
    | 'partnership'
    | 'organization'
    | 'financialReportingType';
  Product:
    | SecuredKeys<Product>
    | 'scriptureReferences'
    | 'scriptureReferencesOverride'
    | 'mediums'
    | 'purposes'
    | 'methodology'
    | 'produces'
    | 'engagement'
    | 'isOverriding';
  Project:
    | SecuredKeys<Project>
    | 'estimatedSubmission'
    | 'step'
    | 'name'
    | 'status'
    | 'deptId'
    | 'mouStart'
    | 'mouEnd'
    | 'rootDirectory'
    | 'member'
    | 'locations'
    | 'engagement'
    | 'partnership'
    | 'budget'
    | 'modifiedAt'
    | 'organization';
  ProjectMember:
    | SecuredKeys<ProjectMember>
    | 'roles'
    | 'member'
    | 'user'
    | 'modifiedAt';
  Region: SecuredKeys<Region> | 'name' | 'director' | 'zone' | 'region';
  Song: SecuredKeys<Song> | 'name' | 'scriptureReferences' | 'produces';
  Story: SecuredKeys<Story> | 'name' | 'scriptureReferences' | 'produces';
  Unavailability:
    | SecuredKeys<Unavailability>
    | 'description'
    | 'start'
    | 'end'
    | 'unavailability';
  User:
    | SecuredKeys<User>
    | 'realFirstName'
    | 'realLastName'
    | 'displayFirstName'
    | 'displayLastName'
    | 'email'
    | 'education'
    | 'organization'
    | 'unavailablity'
    | 'phone'
    | 'timezone'
    | 'bio'
    | 'status'
    | 'roles'
    | 'title';
  Zone: SecuredKeys<Zone> | 'name' | 'director' | 'zone';
  // Add more here as needed
}
