import { Resolver } from '@nestjs/graphql';
import { TranslationProject } from './dto';

@Resolver(TranslationProject.classType)
export class TranslationProjectResolver {}
