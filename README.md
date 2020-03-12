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

## Database Schema

[Here](https://www.lucidchart.com/documents/view/d9131673-4ad4-4e9c-ae60-5c18029cd606)

## Other Docs

[Nest.js](https://docs.nestjs.com/)  
[Cypher Query Builder](https://jamesfer.me/cypher-query-builder/index.html#querying)  
[Cypher Syntax](https://neo4j.com/developer/cypher-basics-i/)  
[GraphQL](https://graphql.org/learn/)  

## License

CORD is [MIT licensed](LICENSE).
