import { Injectable } from '@nestjs/common';
import { EnhancedResource } from '~/common';

@Injectable()
export class EdgeDBAccessPolicyGenerator {
  makeSdl(resource: EnhancedResource<any>) {
    const name = `CanReadGeneratedFromAppPoliciesFor${resource.name}`;
    const sdl = `access policy ${name}\nallow all;`;
    return sdl;
  }
}
