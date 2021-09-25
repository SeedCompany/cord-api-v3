import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { QuestionAnswerRepository } from './question-answer.repository';
import { QuestionAnswerResolver } from './question-answer.resolver';
import { QuestionAnswerService } from './question-answer.service';

@Module({
  imports: [AuthorizationModule, FileModule],
  providers: [
    QuestionAnswerResolver,
    QuestionAnswerService,
    QuestionAnswerRepository,
  ],
  exports: [QuestionAnswerService],
})
export class QuestionAnswerModule {}
