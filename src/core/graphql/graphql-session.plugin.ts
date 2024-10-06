import { Plugin } from './plugin.decorator';

@Plugin()
export class GraphqlSessionPlugin {
  onExecute: Plugin['onExecute'] = ({ args }) => ({
    onExecuteDone: () => {
      // I suspect this is important to ensure that subscriptions
      // will close without burdening the subscribers to do so.
      args.contextValue.session$.complete();
    },
  });
}
