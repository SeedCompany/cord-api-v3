# CORD API v3

## Description

Bible translation project management API.

## Setup

1. Install [Neo4j Desktop](https://neo4j.com/download/) 
1. Create a new database using the Neo4j Desktop GUI with the username and password shown in the environment variables below  
1. Click the `plugins` tab on the new database management view and add the APOC plugin  
1. Start the database   
1. Set an environment variable: `export NODE_ENV=development`
1. Setup the AWS Javscript [SDK](https://aws.amazon.com/sdk-for-node-js/). 
1. Create a `.env.local` file in the root of the project with the following contents:
```
NEO4J_USERNAME=neo4j
NEO4J_URL=bolt://localhost
NEO4J_PASSWORD=asdf
JWT_AUTH_KEY=asdf
FILES_S3_BUCKET=asdf
PORT=3333
```

## Usage

Install: `yarn`  
Develop: `yarn start:dev`  
Test: `yarn test:e2e`  

## Database Schema

[Here]()

## Other Docs

[Nest.js](https://docs.nestjs.com/)  
Neo4j javascript [driver](https://neo4j.com/developer/javascript/) and [api](https://neo4j.com/docs/api/javascript-driver/current/)  
[Cypher Query Builder](https://jamesfer.me/cypher-query-builder/)  
[GraphQL](https://graphql.org/learn/)
[Cypher](https://neo4j.com/developer/cypher-basics-i/)


See [argon2](https://www.npmjs.com/package/argon2) for more info on installing argon2.  


## License

  CORD is [MIT licensed](LICENSE).
