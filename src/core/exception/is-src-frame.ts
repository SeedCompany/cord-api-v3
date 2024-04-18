export const isSrcFrame = (frame: string) =>
  frame.startsWith('    at ')
    ? !frame.includes('node_modules') &&
      !frame.includes('(internal/') &&
      !frame.includes('(node:') &&
      !frame.includes('(<anonymous>)')
    : true;
