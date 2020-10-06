/* eslint-disable @typescript-eslint/no-empty-interface */

/**
 * A mapping of resource/"base node" names to their DTOs.
 * This is used for policies with conditions based on the state of the DTO.
 */
export interface TypeToDto {
  /*
   * Don't add entries here. Instead use declaration merging to add to this
   * interface in the file the DTO is defined in.
   * i.e.
   *   declare module '../../authorization/policies/mapping' {
   *     interface TypeToDto {
   *       X: X;
   *     }
   *   }
   */
}

/**
 * A mapping of resource/"base node" names to their properties that need authorization.
 */
export interface TypeToSecuredProps {
  /*
   * Don't add entries here. Instead use declaration merging to add to this
   * interface in the file the DTO is defined in.
   * i.e.
   *   declare module '../../authorization/policies/mapping' {
   *     interface TypeToSecuredProps {
   *       X: 'prop1' | 'prop2';
   *     }
   *   }
   */
}
