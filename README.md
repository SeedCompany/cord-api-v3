# CORD API v3

## Description

Bible translation project management API.

## Setup

### Docker

API can be started directly with:

```
docker-compose up
```

### Local

1. Install [Neo4j Desktop](https://neo4j.com/download/) or `brew cask install neo4j`
1. Create & start a new database using the Neo4j Desktop GUI
1. Create a `.env.local` file in the root of the project and specify your username and password used at database creation:
   ```ini
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=asdf
   ```
1. Run `yarn` to install dependencies

## Usage

Develop: `yarn start:dev`  
Test: `yarn test:e2e`  

See scripts in package.json for other commands to run  

## Documentation

[Cord Database Schema](https://www.lucidchart.com/documents/view/d9131673-4ad4-4e9c-ae60-5c18029cd606)  
[Nest.js](https://docs.nestjs.com/)  
[Cypher Query Builder](https://jamesfer.me/cypher-query-builder/index.html#querying)  
[Cypher Syntax](https://neo4j.com/developer/cypher-basics-i/)  
[GraphQL](https://graphql.org/learn/)  


# Authorization Concept

The new authorization concept introduces a root user concept as well as `:SecurityGroup` nodes and `:Permission` nodes. See the [database schema](https://www.lucidchart.com/documents/view/d9131673-4ad4-4e9c-ae60-5c18029cd606)


1. When an API server bootstraps, it will create a root `:User` and a `:RootSecurityGroup` using the `ROOT_ADMIN_EMAIL` and `ROOT_ADMIN_PASSWORD` environment variables.
1. The `:RootsecurityGroup` grants its `:member`s all the power available on the platform.
1. Members of the `:RootSecurityGroup` must then delegate power by creating other `:SecurityGroup`s to other members. This is done by creating `:SecurityGroup`s, assigning `:Permission`s to the group, then attaching `:member`s to the `:SecurityGroup`.  
1. When a user creates a `:BaseNode` an `:admin` relationship is created from the `:BaseNode` to the `:User` node. 
1. `:User`s who are `:member`s of a `:SecurityGroup` that grants them `createSecurityGroup = true` can create a `:SecurityGroup`. 
1. `:User`s who have an `:admin` relationship to a `:BaseNode` can attach a `:BaseNode` to a `:SecurityGroup` and also create `:Permission` nodes from the `:SecurityGroup` to the `:BaseNode`
1. The developer needs to ensure all `:BaseNode`s have the `:BaseNode` label. The generic function has been updated, but there may be handwritten queries still out there. The same is true for `:Property` nodes (the generic function for `:Property` nodes hasn't been updated yet).


## Read query

Here is an example of a read query that uses the new authorization concept
```
match (token:Token {value: $token})
<-[:token]-
(user:User)
<-[:member]-
(sg:SecurityGroup)
-[:permission]->
(perm:Permission {
	property: "name",
    read: true
})
-[:baseNode]->
(baseNode:BaseNode)
-[:name]->
(property:Property)
RETURN *
```
Note that the value of the `property` property on the `:Permission` node needs to be the same as the relationship type between the `:BaseNode` and the `:Property` node. In this case, we are trying the read the `name` property.


## License

CORD is [MIT licensed](LICENSE).
