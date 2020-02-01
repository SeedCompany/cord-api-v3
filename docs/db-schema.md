# Database Schema

## Node Types

1. First class nodes
    - Have the `:BaseNode` label and therefore all the properties of a `:BaseNode`
    - Have relationships to `:Property` nodes to store the frontend-visible properties of the `:BaseNode`
    - Have relationships to `:ObjectNode` nodes to facilitate holding properties best encapsulated by `:ObjectNode`s
1. Object nodes
    - Have the `:ObjectNode` label and all the properties of a `:ObjectNode`
    - Purpose is to be container for `:Property` nodes for `:BaseNode` nodes.
    - Have relationships to `:Property` nodes
    - Has an `id` property (on the object node itself) so it can be referenced directly
1. Property nodes
    - Purpose is to hold the frontend-visible properties of a `:BaseNode` or `:ObjectNode`
    - Has a `value` property that stores the actual property of the `:BaseNode` or `:ObjectNode`
    - The reason for holding property values in separate nodes is to facilitate a schema that is able to track all changes to properties. Its more complex, but gives us a history of all changes.
    - Some `:Property` nodes have an additional label, such as `:OrgName` that is used to facilitate constraints or indexes specific to that type of property. For example, `Organization` names must be unique, which means a constraint must be placed on the `:Property` value of its name property. To do this, we must label the `:Property` node with a unique label just for this purpose. We add the  `:OrgName` label and then place a constraint on the `:OrgName.value` property in a cypher call when the database is initialized (or when a feature is added).
1. ACL Nodes
    - Used to facilitate access controls. See Access Permissions section.

## Access Permissions

To enable a mind-numbingly-complex potentiality of different access permission feature requests, we have elected to define access controls in a white-list paradigm through the use of relationships of 1 or more ACL-nodes between a User and the property being accessed. 

This won't make sense without examples.

As a reminder, in cypher, nodes are enclosed by `()` and relationships are enclosed by `[]` with `->` to indication directionality. We'll use psuedo-cypher for examples.

Normally, you'd store a property on the node that holds all of an object's properties:  
`MATCH (project) RETURN project.location`  
But we need access controls on a per-property level. So first we separate a node from its properties by putting properties in their own node. Here's psuedo-cypher on how we would read an object's properties:  
`MATCH (project)-[]->(location) RETURN location.value`  
Now we can add ACL nodes that tell the server whether or not a user has permission to read a property. Here is how we would read that out:  
```cypher
MATCH 
  (token)<-[]-(user)-[*]-(ACL {canReadLocation: true})-[*]->(project)-[]->(location)
RETURN 
  location.value
```
The frontend supplies the token on every query to the API (except the endpoint to create a token). If a record is returned, that means the user can read the permission. If no record is returned, it may mean the user doesn't have permission and a separate query can be called to determine if that is the case. 

The `[*]` means a variable length path and demonstrates that ACL nodes can be attached to other ACL nodes to form any kind of permissioning structure requested. Since this is a white-list paradigm system, a user will have access if any of the ACL nodes between the user and the property grant a permission. If no path exists that grants access to the property permission requested, a request will be denied.

This schema pattern is used on EVERY property the frontend has access to. This means all services must have knowledge of what a user's permission is when reading and writing all properties.

## Multi-Tenancy

To facilitate multiple organizations using Cord Field for their own projects, all `:BaseNode`s and `:ObjectNode`s have an `owningOrgId` property (on the node itself) that corresponds to the `id(node)` (Neo4j node id) of the `Organization` node. 

This means that all queries must first resolve a user's affiliation and then filter the user's request by their organization's `owningOrgId` when they access the properties of a `:BaseNode` or `:ObjectNode`.