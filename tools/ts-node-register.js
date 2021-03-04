require('ts-node').register({
  transformers: program => ({
    before: [
      require('ts-transformer-keys/transformer').default(program),
    ],
  }),
});
