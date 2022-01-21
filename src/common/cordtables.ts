import got from 'got/dist/source';
import { invert, keys } from 'lodash';

const baseUrl = 'http://localhost:8080';
const token =
  'YtQanxWk4AtXbTMn09eDv0pHjPbj1VEmaKjXsaSHx0wQoEcPRc8Pvfh9URGowgHF';

export async function getFromCordTables(
  cordTablesPath: string,
  additionalParams = {}
) {
  return await got.post(`${baseUrl}/${cordTablesPath}`, {
    json: {
      token: token,
      responseType: 'json',
      ...additionalParams,
    },
  });
}

// ------------------------------------------------------------------------------------------------
// Transformation functions
//      - Takes the payload from cordtables and maps the props to the cooresponding dto
// ------------------------------------------------------------------------------------------------
export function transformToDto(
  payloadOrResponse: any,
  tablesToDtoMap: any,
  additionalKeyValPairs?: any
) {
  const dto: any = {};
  for (const key of keys(payloadOrResponse)) {
    dto[tablesToDtoMap[key]] = payloadOrResponse[key];
  }
  for (const key of keys(additionalKeyValPairs)) {
    dto[key] = additionalKeyValPairs[key];
  }
  return dto;
}

export function transformToPayload(
  dto: any,
  tablesToDtoMap: any,
  additionalKeyValPairs?: any
) {
  const payload: any = {};
  const dtoToTables = invert(tablesToDtoMap);
  for (const key of keys(dto)) {
    payload[dtoToTables[key]] = dto[key];
  }
  for (const key of keys(additionalKeyValPairs)) {
    payload[key] = additionalKeyValPairs[key];
  }
  return payload;
}
