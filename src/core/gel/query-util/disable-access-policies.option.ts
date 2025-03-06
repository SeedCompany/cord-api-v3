import { Options } from 'gel';

export const disableAccessPolicies = (options: Options) =>
  options.withConfig({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    apply_access_policies: false,
  });
