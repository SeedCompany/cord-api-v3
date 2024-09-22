import { GraphQLError, GraphQLScalarType } from 'graphql';

export const FileUploadScalar = new GraphQLScalarType({
  name: 'Upload',
  description: 'The `Upload` scalar type represents a file upload.',
  parseValue(value) {
    if (value instanceof File) {
      return value;
    }
    throw new GraphQLError('Upload value invalid.');
  },
  parseLiteral(node) {
    throw new GraphQLError('Upload literal unsupported.', { nodes: node });
  },
  serialize() {
    throw new GraphQLError('Upload serialization unsupported.');
  },
});

export type FileUpload = File;
