import { Module } from '@nestjs/common';
import {
  PromptResponseResolver,
  PromptVariantResponseResolver,
  VariantResponseResolver,
} from './prompt-variant-response.resolver';

@Module({
  providers: [
    PromptResponseResolver,
    PromptVariantResponseResolver,
    VariantResponseResolver,
  ],
})
export class PromptsModule {}
