# CORD API v3

## Description

Bible translation project management API.

## Setup

1. Install [Neo4j Desktop](https://neo4j.com/download/) and start a local database with the username and password shown in the environment variables below.  

1. Set enironment variables:
```
export NEO4J_URL=bolt://localhost
export NEO4J_USERNAME=neo4j
export NEO4J_PASSWORD=asdf
```

## Usage

Install: `yarn`  
Develop: `yarn run start:dev`  
Test: `yarn run test:e2e`  
Create new model class: `nest g class model/className --no-spec`
Create new resolver: `nest g resolver modules/className --no-spec`
Create new service: `nest g service modules/className --no-spec`


## License

  CORD is [MIT licensed](LICENSE).
