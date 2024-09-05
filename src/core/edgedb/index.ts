export * from './reexports';
export { edgeql, EdgeQLArgsOf, EdgeQLReturnOf } from './edgeql';
export * from './options';
export type { OptionsFn } from './options.context';
export * from './edgedb.service';
export * from './withScope';
export * from './errors/exclusivity-violation.error';
export * from './common.repository';
export * from './dto.repository';
export * from './query-util/disable-access-policies.option';
export * from './query-util/cast-to-enum';

declare module './generated-client/typesystem' {
  export interface SetTypesystemOptions {
    future: {
      polymorphismAsDiscriminatedUnions: true;
      strictTypeNames: true;
    };
  }
}
