import { Module } from '@nestjs/common';
import { LanguageResolver } from './language.resolver';
import { LanguageService } from './language.service';

@Module({
  providers: [LanguageResolver, LanguageService],
  exports: [LanguageService],
})
export class LanguageModule {}
