import { Module } from '@nestjs/common';
import {
  PromptResponseResolver,
  PromptVariantResponseResolver,
} from './prompt-variant-response.resolver';

@Module({
  providers: [PromptResponseResolver, PromptVariantResponseResolver],
})
export class PromptsModule {}
