import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { SongResolver } from './song.resolver';
import { SongService } from './song.service';

import { SongRepository } from './song.repository';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [SongResolver, SongService, SongRepository],
  exports: [SongService, SongRepository],
})
export class SongModule {}
