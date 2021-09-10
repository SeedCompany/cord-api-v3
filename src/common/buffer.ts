import { Readable } from 'stream';

export const bufferFromStream = async (stream: Readable) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};
