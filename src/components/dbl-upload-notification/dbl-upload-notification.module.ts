import { Module } from '@nestjs/common';
import { DBLUploadNotificationHandler } from './handlers/dbl-upload-notification.handler';

@Module({
  providers: [DBLUploadNotificationHandler],
})
export class DBLUploadNotificationModule {}
