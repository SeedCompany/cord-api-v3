export class AsyncLocalStorageNoContextException extends Error {
  constructor(message: string) {
    const [major] = process.versions.node.split('.').map(Number);
    if (major === 18) {
      message += `

There's a bug with this process when using Node 18 with debugger ATTACHED (just listening is fine).
Please downgrade to Node 16 for now if you want to debug and are encountering this.

$ brew unlink node && brew install node@16 && brew link --overwrite node@16
`;
    }

    super(message);
  }
}
