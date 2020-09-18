interface ParallelPromise<T> extends Promise<void> {
  thenEach(onfulfilled: (value: T, index: number) => void): this;
  catchEach(onRejected: (reason: any, index: number) => void): this;
  finallyEach(onfinally: (index: number) => void): this;
}

export const evaluatePrallelly = <T, U>(
  max: number,
  queue: T[],
  dequeue: (item: T) => Promise<U>,
): ParallelPromise<U> => {
  queue = queue.slice();
  const thenEach = new Set<(value: U, index: number) => void>();
  const catchEach = new Set<(reason: any, index: number) => void>();
  const finallyEach = new Set<(index: number) => void>();
  const pseudoTick = Promise.resolve();

  return Object.assign(
    new Promise<void>((resolve) => {
      let count = 0;
      let parallel = 0;
      const invoke = () => {
        if (queue.length) {
          parallel++;
          const index = count++;
          const promise = dequeue(queue.shift()!);
          Promise.all([
            promise.finally(next),
            promise.then((result) => thenEach.forEach((callback) => callback(result, index))),
            promise.catch((reason) => catchEach.forEach((callback) => callback(reason, index))),
            promise.finally(() => finallyEach.forEach((callback) => callback(index))),
          ]).catch(() => {}); // avoid UnhandledPromiseRejectionWarning
        }
      };

      const next = () => {
        parallel--;
        if (queue.length) {
          invoke();
        } else if (!parallel) {
          resolve();
        }
      };

      for (let i = 0; i < max; i++) pseudoTick.then(invoke);
    }),
    {
      thenEach(this: ParallelPromise<U>, onfulfilled: (value: U, index: number) => void) {
        thenEach.add(onfulfilled);
        return this;
      },
      catchEach(this: ParallelPromise<U>, onRejected: (reason: any, index: number) => void) {
        catchEach.add(onRejected);
        return this;
      },
      finallyEach(this: ParallelPromise<U>, onfinally: (index: number) => void) {
        finallyEach.add(onfinally);
        return this;
      },
    },
  );
};
