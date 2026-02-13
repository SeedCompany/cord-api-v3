import {
  BullModule,
  BullRegistrar,
  getFlowProducerToken,
} from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import { FlowProducer } from 'bullmq';
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
  constructor(private readonly registrar: BullRegistrar) {}

  onModuleInit() {
    if (!isCli && !isTest) {
      this.registrar.register();
    }
  }
}
