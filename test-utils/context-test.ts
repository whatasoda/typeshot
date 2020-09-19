import { getContext } from '../src/context';

(getContext() as any).test();

throw new Error('test error');
