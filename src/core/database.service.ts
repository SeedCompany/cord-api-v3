import { Injectable } from '@nestjs/common';
import Neo4j from 'neo4j-driver';
import { Driver } from 'neo4j-driver/types/v1';
import { ConfigService } from './config/config.service';

@Injectable()
export class DatabaseService {
  public driver: Driver;

  constructor(private readonly configService: ConfigService) {
    const config = configService.neo4j;
    this.driver = Neo4j.driver(
      config.url,
      Neo4j.auth.basic(config.username, config.password),
      config.driverConfig,
    );
  }
}
