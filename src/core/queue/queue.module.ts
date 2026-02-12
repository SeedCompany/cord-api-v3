import {
  BullModule,
  BullRegistrar,
  getFlowProducerToken,
  getSharedConfigToken,
} from '@nestjs/bullmq';
import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { FlowProducer, type QueueOptions } from 'bullmq';
import { argv, env } from 'node:process';
import { BullConfig } from './bull.config';
import './queue.patch';

const isCli = argv.join(' ').match(/repl|console/);
const isTest = !!env.JEST_WORKER_ID;

@Module({
  imports: [
    BullModule.forRootAsync({
      useClass: BullConfig,
      extraOptions: {
        // Will conditionally register below.
        manualRegistration: true,
      },
    }),
    // I can't figure out a reason for more than one FlowProducer, other than
    // if a different redis connection was needed.
    // We will assume we don't need to support this.
    BullModule.registerFlowProducer({ name: 'default' }),
  ],
  providers: [
    // Alias for easier injection.
    {
      provide: FlowProducer,
      useExisting: getFlowProducerToken('default'),
    },
  ],
  exports: [FlowProducer],
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly registrar: BullRegistrar,
    @Inject(getSharedConfigToken()) private readonly sharedConfig: QueueOptions,
  ) {}

  onModuleInit() {
    const redisConDeclared =
      Object.keys(this.sharedConfig.connection).length > 0;
    if (redisConDeclared && !isCli && !isTest) {
      this.registrar.register();
    }
  }
}
