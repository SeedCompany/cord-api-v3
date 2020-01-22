export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  neo4j: {
    url: process.env.NEO4J_URL || 'bolt://localhost',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'asdf',
  },
  /**
   * Aws S3 Configuration
   */
  fileService: {
    awsConfig: {
      accessKeyId: 'AKIAJON3HD7ALUFYDHTQ',
      bucket: 'cord-field-files-dev',
      region: 'us-west-2',
      secretAccessKey: '51wIIwzkISZetZKo93oerTixT4lkT161bqoSMlZB',
    },
  },
});
