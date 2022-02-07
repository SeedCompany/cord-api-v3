# CORD API v3

## Description

Bible translation project management API.

## Requirements

1. Docker
1. Node 16
1. yarn

## Setup

### Docker

API can be started directly with:

```
docker-compose up
```

### Local

1. Ensure you are using at least node v12.17+. Node 14 is recommended.
1. Use docker to run a database locally: `docker-compose up -d db` . To update your db image: `docker-compose pull db`.
1. Create a `.env.local` file in the root of the project and specify your username and password used at database creation:
   ```ini
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=admin
   ```
1. Run `yarn` to install dependencies

## Usage

Develop: `yarn start:dev`  
Test: `yarn test:e2e`

See scripts in package.json for other commands to run

## Cypher

### Useful commands

Delete all data, for small data sizes (n < 100k-ish)

```
match (n) detach delete n
```

Delete all data in a large DB (must have the APOC plugin installed)

```
call apoc.periodic.iterate("MATCH (n) return n", "DETACH DELETE n", {batchSize:1000})
yield batches, total return batches, total
```

Delete all constraints and indexes (must have the APOC plugin installed)

```
call apoc.schema.assert({}, {})
```

Return number of nodes in DB

```
match (n) return count(n)
```

Return all data (don't use for large DBs)

```
match (n) return n
```

## Documentation

[Cord Database Schema](https://www.lucidchart.com/documents/view/d9131673-4ad4-4e9c-ae60-5c18029cd606)  
[Cord Property Table](https://docs.google.com/spreadsheets/d/e/2PACX-1vTe065oOA5S8QXqfBZQGqK193kIi4La2ex9ig-lDjeYmwekjMxyx-w-Mol8YRkI5YNp4o8PjI6bmaoM/pubhtml)  
[Nest.js](https://docs.nestjs.com/)  
[Cypher Query Builder](https://jamesfer.me/cypher-query-builder/index.html#querying)  
[Cypher Syntax](https://neo4j.com/developer/cypher-basics-i/)  
[GraphQL](https://graphql.org/learn/)

# Notes

1. When an API server bootstraps, it will create a root `:User` and a `:RootSecurityGroup` using the `ROOT_ADMIN_EMAIL` and `ROOT_ADMIN_PASSWORD` environment variables. It is not necessary to define those variables as defaults are used (`devops@tsco.org` and `admin`);
1. User permissions are granted by their role. Roles are defined in the `authorization` service. Currently roles are only updated via the graphql API (http://localhost:3000/graphql), there is no front end UI for changing roles.

## License

CORD is [MIT licensed](LICENSE).
