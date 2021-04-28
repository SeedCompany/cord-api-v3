import { stripIndent } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';

export const deleteBaseNode = (query: Query) =>
  query
    .match([
      node('baseNode'),
      /**
         in this case we want to set Deleted_ labels for all properties
         including active = false
         deleteProperties does this, but deletes from before that was changed only prefixed
         unique property labels
         */
      relation('out', ''),
      node('propertyNode', 'Property'),
    ])
    // Mark any parent base node relationships (pointing to the base node) as active = false.
    .optionalMatch([
      node('baseNode'),
      relation('in', 'baseNodeRel'),
      node('', 'BaseNode'),
    ])
    .setValues({
      'baseNode.deletedAt': DateTime.local(),
      'baseNodeRel.active': false,
    })
    /**
       if we set anything on property nodes or property relationships in the query above (as was done previously)
       we need to distinct propertyNode to avoid collecting and labeling each propertyNode more than once
       */
    .with('[baseNode] + collect(propertyNode) as nodeList')
    /**
       check if labels already have the "Deleted_" prefix to avoid "Deleted_Deleted_"
       yielding a node from the label procedures is necessary I believe
       they're not used in rest of the query and are aliased to avoid colliding with the unwound "node" alias
       */
    .raw(
      stripIndent`
        unwind nodeList as node
        with node,
        reduce(
          deletedLabels = [], label in labels(node) |
            case
              when label starts with "Deleted_" then deletedLabels + label
              else deletedLabels + ("Deleted_" + label)
            end
        ) as deletedLabels
        call apoc.create.removeLabels(node, labels(node)) yield node as nodeRemoved
        with node, deletedLabels
        call apoc.create.addLabels(node, deletedLabels) yield node as nodeAdded
      `
    );
