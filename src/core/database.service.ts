import { Injectable } from '@nestjs/common';
import Neo4j, { Driver } from 'neo4j-driver';

@Injectable()
export class DatabaseService {
  public driver: Driver;

  constructor() {
    this.driver = Neo4j.driver(
      process.env.NEO4J_URL,
      Neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
    );
  }
}
