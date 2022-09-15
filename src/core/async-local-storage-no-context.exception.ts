export class AsyncLocalStorageNoContextException extends Error {
  constructor(message: string) {
    const [major] = process.versions.node.split('.').map(Number);
    if (major === 18) {
      message += `

There's a bug with this process when using Node 18.8 or lower with debugger ATTACHED (just listening is fine).
Please upgrade to Node 18.9+ if you want to debug and are encountering this.
`;
    }

    super(message);
  }
}
