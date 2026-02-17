import type { ConditionalKeys } from 'type-fest';

// Interface to allow other types to be added via declaration merging.
export interface DeclareContextTypes {
  http: true;
}

export type ContextType = ConditionalKeys<DeclareContextTypes, true>;

// Need to alias for the overrides below to apply.
type MyContextType = ContextType;

declare module '@nestjs/common/interfaces/features/arguments-host.interface' {
  export interface ArgumentsHost {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    getType<TContext extends string = MyContextType>(): TContext;
  }
}

declare module '@nestjs/core/helpers/execution-context-host' {
  export interface ExecutionContextHost {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    getType<TContext extends string = MyContextType>(): TContext;
  }
}
