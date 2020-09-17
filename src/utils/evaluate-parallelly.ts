export const evaluatePrallelly = <T>(max: number, dequeue: (onLastItem: () => void) => Promise<T>) => {
  type Result = { payload: T[]; errors: null } | { payload: (T | null)[]; errors: Error[] };
  return new Promise<Result>((resolve) => {
    const payload: (T | null)[] = [];
    const errors: Error[] = [];
    let isFinished = false;
    let hasError = false;
    let count = 0;
    let parallel = 0;
    const finish = () => void (isFinished = true);
    const next = async () => {
      if (isFinished) return;

      parallel++;
      const index = count++;
      try {
        payload[index] = await dequeue(finish);
      } catch (e) {
        hasError = true;
        payload[index] = null;
        errors[index] = e;
      }
      parallel--;

      if (isFinished) {
        if (!parallel) {
          resolve(hasError ? { payload, errors } : { payload: payload as T[], errors: null });
        }
      } else {
        Promise.resolve().then(next);
      }
    };
    for (let i = 0; i < max; i++) next();
  });
};
