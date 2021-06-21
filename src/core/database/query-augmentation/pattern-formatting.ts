import { Create, Match, Merge } from 'cypher-query-builder';

// Add line breaks for each pattern when there's multiple per statement
for (const Cls of [Match, Create, Merge]) {
  const origBuild = Cls.prototype.build;
  Cls.prototype.build = function build() {
    const str = origBuild.call(this);
    return str.split(', ').join(',\n    ');
  };
}
