import { validate, ValidationError } from 'class-validator';
import { ScriptureReferenceInput } from './scripture-reference.dto';
import 'reflect-metadata';

const runValidation = (ref: ScriptureReferenceInput) => {
  // @ts-expect-error we know it's abstract, but the instance is actually used
  // at runtime and validator needs the class instance for the metadata.
  return validate(Object.assign(new ScriptureReferenceInput(), ref));
};
const expectSingleConstraintFailure = (
  errors: ValidationError[],
  expectedCode: string,
  message: string,
) => {
  const constraints = errors[0].constraints ?? {};
  const actualCode = Object.keys(constraints)[0];
  expect(actualCode).toEqual(expectedCode);
  expect(constraints[expectedCode]).toEqual(message);
};

describe('ScriptureReference', () => {
  it('Valid reference', async () => {
    const result = await runValidation({
      book: 'Matt',
      chapter: 1,
      verse: 1,
    });
    expect(result).toHaveLength(0);
  });
  it('Invalid book', async () => {
    const result = await runValidation({
      book: '1st Opinions',
      chapter: 1,
      verse: 1,
    });
    expectSingleConstraintFailure(
      result,
      'ScriptureBook',
      'Not a valid Bible book',
    );
  });
  it('Invalid chapter', async () => {
    const result = await runValidation({
      book: 'Matt',
      chapter: 40,
      verse: 1,
    });
    expectSingleConstraintFailure(
      result,
      'ScriptureChapter',
      'Matthew does not have chapter 40',
    );
  });
  it('Invalid verse', async () => {
    const result = await runValidation({
      book: 'Matt',
      chapter: 1,
      verse: 1000,
    });
    expectSingleConstraintFailure(
      result,
      'ScriptureVerse',
      'Matthew 1 does not have verse 1000',
    );
  });
});
