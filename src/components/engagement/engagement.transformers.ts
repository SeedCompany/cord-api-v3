import { DateTime } from 'luxon';
import {
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
} from '../../core/database/results';

export const securedPropertyDefinitions = {
  status: true,
  statusModifiedAt: true,
  completeDate: true,
  disbursementCompleteDate: true,
  communicationsCompleteDate: true,
  initialEndDate: true,
  startDate: true,
  endDate: true,
  startDateOverride: true,
  endDateOverride: true,
  modifiedAt: true,
  lastSuspendedAt: true,
  lastReactivatedAt: true,
  ceremony: true,

  //Language Specific
  firstScripture: true,
  lukePartnership: true,
  sentPrintingDate: true,
  paraTextRegistryId: true,
  pnp: true,
  language: true,

  //Internship Specific
  position: true,
  growthPlan: true,
  methodologies: true,
  intern: true,
  mentor: true,
  countryOfOrigin: true,
};

export function transformEngagementFromRepositoryToDTO(result: any) {
  const props = parsePropList(result.propList);
  const securedProperties = parseSecuredProperties(
    props,
    result.permList,
    securedPropertyDefinitions
  );

  //const project = await this.projectService.readOne(
  //  result.projectId,
  //  session
  //);

  //const canReadStartDate =
  //  project.mouStart.canRead && securedProperties.startDateOverride.canRead;
  //const startDate = canReadStartDate
  //  ? props.startDateOverride ?? project.mouStart.value
  //  : null;
  //const canReadEndDate =
  //  project.mouEnd.canRead && securedProperties.endDateOverride.canRead;
  //const endDate = canReadEndDate
  //  ? props.endDateOverride ?? project.mouEnd.value
  //  : null;

  const canReadEndDate = true;
  const endDate = DateTime.utc();
  const canReadStartDate = true;
  const startDate = DateTime.utc();

  return {
    __typename: result.__typename,
    ...securedProperties,
    ...parseBaseNodeProperties(result.node),
    status: props.status,
    modifiedAt: props.modifiedAt,
    startDate: {
      value: startDate,
      canRead: canReadStartDate,
      canEdit: false,
    },
    endDate: {
      value: endDate,
      canRead: canReadEndDate,
      canEdit: false,
    },
    methodologies: {
      ...securedProperties.methodologies,
      value: securedProperties.methodologies.value ?? [],
    },
    ceremony: {
      ...securedProperties.ceremony,
      value: result.ceremonyId,
    },
    language: {
      ...securedProperties.language,
      value: result.languageId,
    },
    intern: {
      ...securedProperties.intern,
      value: result.internId,
    },
    countryOfOrigin: {
      ...securedProperties.countryOfOrigin,
      value: result.countryOfOriginId,
    },
    mentor: {
      ...securedProperties.mentor,
      value: result.mentorId,
    },
  };
}
