import got from 'got/dist/source';

const baseUrl = 'http://localhost:8080';
const token =
  'KpZ3RxUcuoZ1euAr3kQJb1Bq7dfzQ2d4Z5qfHWcaHZxO4gfoj3kaQqW0eFao4Ja5';

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
