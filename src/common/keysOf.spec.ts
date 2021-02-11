import { keys as keysOf } from 'ts-transformer-keys';

interface Foo {
  foo: string;
  bar: string;
}

it('keys transformer is configured', () => {
  const fooKeys = keysOf<Foo>();
  expect(fooKeys).toEqual(['foo', 'bar']);
});
