import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { fstat } from 'node:fs';
import { Client, Pool } from 'pg';
import { ConfigService } from '..';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class PostgresService {
  constructor(private readonly config: ConfigService) {}
 
  pool = new Pool();
  client = new Client(this.config.postgres);

  async executeSQLFiles(dirPath:string,connectedClient:Client):Promise<number>{
    fs.readdirSync(dirPath).forEach(async (name)=>{
      const fileOrDirPath = path.join(dirPath,name);
      if(fs.existsSync(fileOrDirPath) && fs.lstatSync(fileOrDirPath).isDirectory()){
        console.log('dir: ',fileOrDirPath);
        this.executeSQLFiles(fileOrDirPath, connectedClient);
      }
      else{
        // load script into db
        console.log('file: ',fileOrDirPath);
        const sql = fs.readFileSync(fileOrDirPath).toString();
        await this.client.query(sql);
      }
    });
    return 0;
  }
  
  async db_init():Promise<number>{
    await this.client.connect();
    const dbInitPath = path.join(__dirname,'..','..', '..', 'src/core/postgres/sql/db_init')
    const fileExecutionStatus = await this.executeSQLFiles(dbInitPath,this.client)
    return 0;
  }

  @Lazy() get connectedClient(): Promise<Client> {

    return this.client.connect().then(() => {
      console.log(this.client);
      return this.client;
    });
  }
}
