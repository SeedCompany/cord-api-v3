export const expectNotFound = async (action: Promise<any>) => {
  let thrown;
  try {
    await action;
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown.extensions.code).toEqual('NotFound');
};
