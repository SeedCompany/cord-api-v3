import got from 'got/dist/source';

const baseUrl = 'http://localhost:8080';
const token =
  '6SXkazOrHP1irRpkFEQXPSERDrJK4op0F2OWM2xqgyb56LddmwLGim6ktqIoFXIF';

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
