import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { SongLoader } from './song.loader';
import { SongRepository } from './song.repository';
import { SongResolver } from './song.resolver';
import { SongService } from './song.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [SongResolver, SongLoader, SongService, SongRepository],
  exports: [SongService],
})
export class SongModule {}
