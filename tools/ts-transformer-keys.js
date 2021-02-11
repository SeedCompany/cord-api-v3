const transformer = require('ts-transformer-keys/transformer').default;
module.exports.before = (options, program) => transformer(program);
