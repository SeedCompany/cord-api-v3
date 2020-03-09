import * as AWS from 'aws-sdk';
import { Injectable } from '@nestjs/common';
import { EnvironmentService } from './config/environment.service';

@Injectable()
export class SesService {
    private ses: any;
    constructor(private readonly env: EnvironmentService){
        AWS.config.update({
            accessKeyId: this.env.string("AWS_ACCESS_KEY").optional("cord-field"),
            secretAccessKey: this.env.string("AWS_SECRET_KEY").optional("cord-field"),
            region: this.env.string("AWS_REGION").optional("cord-field"),
        })
        this.ses = new AWS.SES({correctClockSkew: true});
    }

    async sendEmail(params: any): Promise<boolean>{
        return this.ses.sendEmail(params, (err: any, data: any) =>  {
            if (err){
                console.log(err, err.stack);
                return false
            }else{
               console.log(data);
               return true;
            }
        });
    }
    
}