import { Module } from '@nestjs/common';
import { ScriptureModule } from '../scripture/scripture.module';
import { SongResolver } from './song.resolver';
import { SongService } from './song.service';

@Module({
  imports: [ScriptureModule],
  providers: [SongResolver, SongService],
  exports: [SongService],
})
export class SongModule {}
