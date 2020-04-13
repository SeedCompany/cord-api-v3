import { Module } from '@nestjs/common';
import { AwsSESFactory } from './aws-ses.factory';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService, AwsSESFactory],
  exports: [EmailService],
})
export class EmailModule {}
