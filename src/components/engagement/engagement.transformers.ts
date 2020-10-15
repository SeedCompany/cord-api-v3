import { ServerException } from '../../common';
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

export const securedPropertyDefinitionsLanguageEngagement = {
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
};

export const securedPropertyDefinitionsInternshipEngagement = {
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

  //Internship Specific
  position: true,
  growthPlan: true,
  methodologies: true,
  intern: true,
  mentor: true,
  countryOfOrigin: true,
};

// TODO: This function accepting a result and a projectSecuredPropertiesMap as two separate objects
//       is a compromise due to the current repository call for retrieving the securedPropertiesMap
//       not chaining easily within the call to hydrate engagements. A refactor could simplify the
//       required parameters down to one.
export function transformEngagementFromRepositoryToDTO(repositoryDTO: any) {
  const LanguageEngagementType = 'LanguageEngagement';
  const InternshipEngagementType = 'InternshipEngagement';
  const engagementType = repositoryDTO.engagementResult.__typename as string;
  if (engagementType === LanguageEngagementType) {
    return transformLanguageEngagementFromRepositoryToDTO(repositoryDTO);
  } else if (engagementType === InternshipEngagementType) {
    return transformInternshipEngagementFromRepositoryToDTO(repositoryDTO);
  } else {
    throw new ServerException(`unknown Engagement type: ${engagementType}`);
  }
}

function transformLanguageEngagementFromRepositoryToDTO(repositoryDTO: any) {
  const result = repositoryDTO.engagementResult;
  const projectSecuredPropertiesMap = repositoryDTO.projectSecuredPropertiesMap;

  const props = parsePropList(result.propList);
  const securedProperties = parseSecuredProperties(
    props,
    result.permList,
    securedPropertyDefinitionsLanguageEngagement
  );

  const canReadStartDate =
    projectSecuredPropertiesMap.mouStart.canRead &&
    securedProperties.startDateOverride.canRead;
  const startDate = canReadStartDate
    ? props.startDateOverride ?? projectSecuredPropertiesMap.mouStart.value
    : null;
  const canReadEndDate =
    projectSecuredPropertiesMap.mouEnd.canRead &&
    securedProperties.endDateOverride.canRead;
  const endDate = canReadEndDate
    ? props.endDateOverride ?? projectSecuredPropertiesMap.mouEnd.value
    : null;

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
    ceremony: {
      ...securedProperties.ceremony,
      value: result.ceremonyId,
    },
    language: {
      ...securedProperties.language,
      value: result.languageId,
    },
  };
}

function transformInternshipEngagementFromRepositoryToDTO(repositoryDTO: any) {
  const result = repositoryDTO.engagementResult;
  const projectSecuredPropertiesMap = repositoryDTO.projectSecuredPropertiesMap;

  const props = parsePropList(result.propList);
  const securedProperties = parseSecuredProperties(
    props,
    result.permList,
    securedPropertyDefinitionsInternshipEngagement
  );

  const canReadStartDate =
    projectSecuredPropertiesMap.mouStart.canRead &&
    securedProperties.startDateOverride.canRead;
  const startDate = canReadStartDate
    ? props.startDateOverride ?? projectSecuredPropertiesMap.mouStart.value
    : null;
  const canReadEndDate =
    projectSecuredPropertiesMap.mouEnd.canRead &&
    securedProperties.endDateOverride.canRead;
  const endDate = canReadEndDate
    ? props.endDateOverride ?? projectSecuredPropertiesMap.mouEnd.value
    : null;

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
