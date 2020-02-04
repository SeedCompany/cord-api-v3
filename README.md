# CORD API v3

## Description

Bible translation project management API.

## Setup

1. Install [Neo4j Desktop](https://neo4j.com/download/) 
1. Create a new database using the Neo4j Desktop GUI with the username and password shown in the environment variables below  
1. Click the `plugins` tab on the new database management view and add the APOC plugin  
1. Start the database   
1. Set enironment variables:   
```
export NEO4J_URL=bolt://localhost
export NEO4J_USERNAME=neo4j
export NEO4J_PASSWORD=asdf
export JWT_AUTH_KEY=asdf
```
You will also need the following environment variables set:  get values from the team
```
export AWS_SECRET_ACCESS_KEY=
export AWS_ACCESS_KEY_ID=
export FILES_S3_BUCKET=
```


## Usage

Install: 
1. `brew install gcc`
1. `npm install -g node-gyp`
1. `CXX=g++ yarn install argon2`
1. `yarn`  

See [argon2](https://www.npmjs.com/package/argon2) for more info on installing argon2.

Develop: `yarn run start:dev`  
Test: `yarn run test:e2e`  
Create new model class: `nest g class model/className --no-spec`  
Create new resolver: `nest g resolver components/className --no-spec`  
Create new service: `nest g service components/className --no-spec`  


## License

  CORD is [MIT licensed](LICENSE).
