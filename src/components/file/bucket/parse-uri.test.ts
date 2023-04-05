import { parseUri } from './parse-uri';

test.each<[uri: string, output: [type: string, path: string, ro: boolean]]>([
  // absolute
  ['/var/log', ['', '/var/log', false]],
  ['files:///var/log', ['files', '/var/log', false]],
  ['FILES:///var/log:ro', ['files', '/var/log', true]],
  ['files:///var/log:readonly', ['files', '/var/log', true]],
  ['/var/log:ro', ['', '/var/log', true]],

  // relative
  ['.', ['', '.', false]],
  ['./asdf', ['', './asdf', false]],
  ['files://./asdf:ro', ['files', './asdf', true]],
  ['files://asdf:RO', ['files', 'asdf', true]],
  ['./asdf:ro', ['', './asdf', true]],
  ['./asdf:readOnly', ['', './asdf', true]],

  // windose
  ['C:\\\\asdf\\\\sdf', ['', 'C:\\\\asdf\\\\sdf', false]],
  ['C:\\\\asdf\\\\sdf:ro', ['', 'C:\\\\asdf\\\\sdf', true]],
  ['C:\\\\asdf\\\\sdf:readonly', ['', 'C:\\\\asdf\\\\sdf', true]],
  ['files://C:\\\\asdf\\\\sdf:readonly', ['files', 'C:\\\\asdf\\\\sdf', true]],

  // s3
  ['s3://foo', ['s3', 'foo', false]],
  ['s3://foo/path', ['s3', 'foo/path', false]],
  ['S3://foo/path:ro', ['s3', 'foo/path', true]],
  ['s3://foo/path:readonly', ['s3', 'foo/path', true]],
  ['s3://foo:readonly', ['s3', 'foo', true]],
  ['s3://my.bucket.com', ['s3', 'my.bucket.com', false]],
])('%s', (uri, output) => {
  const parsed = parseUri(uri);
  expect([parsed.type, parsed.path, parsed.readonly]).toEqual(output);
});
