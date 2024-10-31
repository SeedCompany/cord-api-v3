import { stripIndent } from 'common-tags';
import { titleCase } from 'title-case';

interface Options {
  graphRef?: string;
  [key: string]: any;
}

export const apolloExplorer = (options: Options) => {
  const { title, ...config } = options;
  const product = config.graphRef ? 'explorer' : 'sandbox';
  return stripIndent`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>${title}</title>
    </head>
    <body style="margin: 0; overflow-x: hidden; overflow-y: hidden">
    <div id="sandbox" style="height:100vh; width:100vw;"></div>
    <script src="https://embeddable-${product}.cdn.apollographql.com/${
    product === 'sandbox' ? '_latest' : 'v3'
  }/embeddable-${product}.umd.production.min.js"></script>
    <script>
      var initialEndpoint = window.location.href;
      var config = ${JSON.stringify(config)};
      // https://www.apollographql.com/docs/apollo-sandbox
      new window.Embedded${titleCase(product)}({
        target: '#sandbox',
        initialEndpoint,
        ...config,
      });
    </script>
    </html>
  `;
};
