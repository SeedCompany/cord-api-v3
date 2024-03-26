import type { Client } from 'edgedb/dist/baseClient.js';
import {
  Options as EdgeDBOptions,
  RetryOptions,
  Session,
  SimpleRetryOptions,
  SimpleTransactionOptions,
  TransactionOptions,
} from 'edgedb/dist/options.js';

// Flatten Session modifiers, just as Client does.
export class Options extends EdgeDBOptions {
  static defaults() {
    return new Options(EdgeDBOptions.defaults());
  }
  withTransactionOptions(opt: TransactionOptions | SimpleTransactionOptions) {
    return new Options(super.withTransactionOptions(opt));
  }
  withRetryOptions(opt: RetryOptions | SimpleRetryOptions) {
    return new Options(super.withRetryOptions(opt));
  }
  withSession(opt: Session) {
    return new Options(super.withSession(opt));
  }
  withModuleAliases(aliases: { [name: string]: string }) {
    return this.withSession(this.session.withModuleAliases(aliases));
  }
  withConfig(config: Config) {
    return this.withSession(this.session.withConfig(config));
  }
  withGlobals(globals: { [name: string]: any }) {
    return this.withSession(this.session.withGlobals(globals));
  }
}

type Config = Parameters<Client['withConfig']>[0];
