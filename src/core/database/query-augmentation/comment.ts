import { stripIndent } from 'common-tags';
import { Clause, Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Add a query comment
     *
     * @example
     * query.comment('Find all things')
     *
     * @example Multiline
     * query.comment(`
     *   For all cars:
     *     - Wash
     *     - Fill with gas
     * `)
     *
     * @example Used as a template tag
     * query.comment`
     *   For all cars:
     *     - Wash
     *     - Fill with gas
     * `
     */
    comment(comment: CommentIn, ...args: unknown[]): this;
  }
}

Query.prototype.comment = function comment(
  this: Query,
  comment: CommentIn,
  ...args: unknown[]
) {
  return this.continueChainClause(new Comment(comment, ...args));
};

type CommentIn = string | TemplateStringsArray;

class Comment extends Clause {
  private readonly comment: string;

  constructor(comment: CommentIn, ...args: unknown[]) {
    super();
    this.comment =
      typeof comment === 'string'
        ? stripIndent(comment)
        : stripIndent(comment, ...args);
  }

  build() {
    return '// ' + this.comment.replace(/\n/g, '\n// ');
  }
}
