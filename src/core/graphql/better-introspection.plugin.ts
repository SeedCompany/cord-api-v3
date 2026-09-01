import { getIntrospectionQuery } from 'graphql/index';
import { Plugin } from './plugin.decorator';

@Plugin()
export class BetterIntrospectionPlugin {
  onParams: Plugin['onParams'] = ({ params, setParams }) => {
    if (params.operationName !== 'IntrospectionQuery') {
      return;
    }
    // Help out by replacing the introspection query with all the
    // additional options (new features) that we support.
    const query = getIntrospectionQuery({
      descriptions: true,
      specifiedByUrl: true,
      directiveIsRepeatable: true,
      schemaDescription: true,
      inputValueDeprecation: true,
      oneOf: true,
    });
    setParams({ ...params, query });
  };
}
