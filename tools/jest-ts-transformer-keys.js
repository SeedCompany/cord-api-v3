const transformer = require('ts-transformer-keys/transformer').default;

module.exports.name = 'ts-transformer-keys';
module.exports.version = 1; // increment when changes are made below
module.exports.factory = (cs) => transformer(cs.tsCompiler.program);
