import { Injectable } from '@nestjs/common';
import Neo4j from 'neo4j-driver';
import { Driver } from 'neo4j-driver/types/v1';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService {
  public driver: Driver;

  constructor(private readonly configService: ConfigService) {
    this.driver = Neo4j.driver(
      this.configService.get<string>('neo4j.url'),
      Neo4j.auth.basic(
        this.configService.get<string>('neo4j.username'),
        this.configService.get<string>('neo4j.password')),
    );
  }
}
