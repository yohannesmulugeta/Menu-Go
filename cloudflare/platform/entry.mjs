import {DurableObject} from 'cloudflare:workers';
import runtime,{dispatchPrivateOperation} from './private-runtime.mjs';

// Private binding only: no public URL, fetch handler, stored passwords or timers.
// Auth requests are partitioned by source; image requests by restaurant. The
// existing D1 transactions remain authoritative across every object instance.
export class MenuPrivateOperations extends DurableObject {
  async dispatch(request) {
    return dispatchPrivateOperation(request,this.env);
  }
}

export default runtime;
