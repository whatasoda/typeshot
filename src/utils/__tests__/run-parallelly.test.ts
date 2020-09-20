import { evaluatePrallelly } from '../evaluate-parallelly';

const createTestPromise = () => {
  const acc = Object.create(null);
  acc.promise = new Promise((resolve, reject) => {
    acc.resolve = resolve;
    acc.reject = reject;
  });
  return acc as {
    resolve: () => void;
    reject: () => void;
    promise: Promise<void>;
  };
};

describe('evaluatePrallelly', () => {
  test('works successfully with all successful promises', async () => {
    const queue = Array.from({ length: 12 }).map(() => createTestPromise());

    let dequeued = 0;
    let fulfilled = 0;
    let rejected = 0;
    let finallyCount = 0;
    let isResolved = false;
    const assert = (resolved: boolean, ...args: [number, number, number, number]) => {
      expect(isResolved).toBe(resolved);
      expect(dequeued).toBe(args[0]);
      expect(fulfilled).toBe(args[1]);
      expect(rejected).toBe(args[2]);
      expect(finallyCount).toBe(args[3]);
    };
    const all = evaluatePrallelly(5, queue, ({ promise }) => (dequeued++, promise));
    all.thenEach(() => fulfilled++);
    all.catchEach(() => rejected++);
    all.finallyEach(() => finallyCount++);
    all.then(() => (isResolved = true));
    assert(false, 0, 0, 0, 0);

    await Promise.resolve();
    assert(false, 5, 0, 0, 0);

    await Promise.resolve();
    assert(false, 5, 0, 0, 0);

    queue[0].resolve();
    await Promise.resolve();
    assert(false, 6, 1, 0, 1);

    await Promise.resolve();
    assert(false, 6, 1, 0, 1);

    queue.slice(1).forEach(({ resolve }) => resolve());
    assert(false, 6, 1, 0, 1);

    await Promise.resolve();
    assert(false, 11, 6, 0, 6);

    await Promise.resolve();
    assert(false, 12, 11, 0, 11);

    await Promise.resolve();
    assert(false, 12, 12, 0, 12);

    await Promise.resolve();
    assert(true, 12, 12, 0, 12);
  });

  test('works successfully if queue length is not reached to max count', async () => {
    const queue = Array.from({ length: 3 }).map(() => createTestPromise());

    let dequeued = 0;
    let fulfilled = 0;
    let rejected = 0;
    let finallyCount = 0;
    let isResolved = false;
    const assert = (resolved: boolean, ...args: [number, number, number, number]) => {
      expect(isResolved).toBe(resolved);
      expect(dequeued).toBe(args[0]);
      expect(fulfilled).toBe(args[1]);
      expect(rejected).toBe(args[2]);
      expect(finallyCount).toBe(args[3]);
    };

    const all = evaluatePrallelly(5, queue, ({ promise }) => (dequeued++, promise));
    all.thenEach(() => fulfilled++);
    all.catchEach(() => rejected++);
    all.finallyEach(() => finallyCount++);
    all.then(() => (isResolved = true));
    assert(false, 0, 0, 0, 0);

    await Promise.resolve();
    assert(false, 3, 0, 0, 0);

    await Promise.resolve();
    assert(false, 3, 0, 0, 0);

    queue[0].resolve();
    await Promise.resolve();
    assert(false, 3, 1, 0, 1);

    await Promise.resolve();
    assert(false, 3, 1, 0, 1);

    queue.slice(1).forEach(({ resolve }) => resolve());
    assert(false, 3, 1, 0, 1);

    await Promise.resolve();
    assert(false, 3, 3, 0, 3);

    await Promise.resolve();
    assert(true, 3, 3, 0, 3);
  });

  test('works successfully with both successful and failed promises', async () => {
    const queue = Array.from({ length: 12 }).map(() => createTestPromise());

    let dequeued = 0;
    let fulfilled = 0;
    let rejected = 0;
    let finallyCount = 0;
    let isResolved = false;
    const assert = (resolved: boolean, ...args: [number, number, number, number]) => {
      expect(isResolved).toBe(resolved);
      expect(dequeued).toBe(args[0]);
      expect(fulfilled).toBe(args[1]);
      expect(rejected).toBe(args[2]);
      expect(finallyCount).toBe(args[3]);
    };
    const all = evaluatePrallelly(5, queue, ({ promise }) => (dequeued++, promise));
    all.thenEach(() => fulfilled++);
    all.catchEach(() => rejected++);
    all.finallyEach(() => finallyCount++);
    all.then(() => (isResolved = true));
    assert(false, 0, 0, 0, 0);

    await Promise.resolve();
    assert(false, 5, 0, 0, 0);

    await Promise.resolve();
    assert(false, 5, 0, 0, 0);

    queue[0].reject();
    await Promise.resolve();
    assert(false, 6, 0, 1, 1);

    await Promise.resolve();
    assert(false, 6, 0, 1, 1);

    queue.slice(1).forEach(({ resolve, reject }, i) => (i % 2 ? reject() : resolve()));
    assert(false, 6, 0, 1, 1);

    await Promise.resolve();
    assert(false, 11, 3, 3, 6);

    await Promise.resolve();
    assert(false, 12, 5, 6, 11);

    await Promise.resolve();
    assert(false, 12, 6, 6, 12);

    await Promise.resolve();
    assert(true, 12, 6, 6, 12);
  });
});
