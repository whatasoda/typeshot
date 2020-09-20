import { getContext } from '../src/program/context';

(getContext() as any).test();

throw new Error('test error');
