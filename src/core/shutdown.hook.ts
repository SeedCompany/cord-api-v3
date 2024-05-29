import { OnApplicationShutdown, Provider } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export class ShutdownHook extends Observable<void> {}

class ShutdownHookImpl
  extends Subject<void>
  implements OnApplicationShutdown, ShutdownHook
{
  onApplicationShutdown() {
    this.next();
    this.complete();
  }
}

export const ShutdownHookProvider: Provider = {
  provide: ShutdownHook,
  useClass: ShutdownHookImpl,
};
