import { Subscribable, of, never, timer } from 'rxjs';
import { map } from 'rxjs/operators';
export { concat } from 'rxjs';
export { map, tap, scan } from 'rxjs/operators';

/**
 * Returns a random hex string, like a Git SHA. Not guaranteed to
 * be unique - just to within about 1 in 10,000.
 */
export const randomId = (length: number = 7) => {
  return Math.floor(Math.pow(2, length * 4) * Math.random())
    .toString(16)
    .padStart(length, '0');
};

export interface AwaitableObservable
  extends PromiseLike<any>,
    Subscribable<any> {
  toPromise(): PromiseLike<any>;
}

/**
 * Returns an Observable of the value, or result of the function call, after
 * the number of milliseconds given. After is lazy and cancelable! So nothing happens until .subscribe
 * is called explicitly (via subscribe) or implicitly (toPromise(), await).
 * For a delay of 0, the function is executed synchronously when .subscribe is called.
 * @returns An Observable of the object or thunk return value. It is 'thenable', so may also be awaited directly.
 * ```
 * // Examples:
 * // awaited Promise
 * await after(100, () => new Date())
 * // unawaited Promise
 * after(100, () => new Date()).toPromise()
 * // unresolving Promise
 * after(Infinity, () => new Date()).toPromise()
 * ```
 */
export const after = (
  ms: number,
  objOrFn?: any,
  label?: any
): AwaitableObservable => {
  const valueProducer =
    typeof objOrFn === 'function' ? () => objOrFn(label) : () => objOrFn;
  const delay = ms <= 0 ? of(0) : ms === Infinity ? never() : timer(ms);

  const resultObs = delay.pipe(map(valueProducer));

  // after is a 'thenable, thus usable with await.
  // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
  // @ts-ignore
  resultObs.then = function(resolve, reject) {
    return resultObs.toPromise().then(resolve, reject);
  };
  // @ts-ignore
  return resultObs;
};

/** Executes the given function on the microtask queue.
 * The microtask queue flushes before the macrotask queue.
 * @returns A Promise for its return value
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
 * @see queueMicrotask, Promise.resolve
 */
export function microq(fn: Function) {
  // @ts-ignore
  return Promise.resolve().then(fn);
}

/** Executes the given function on the macrotask queue.
 * The macrotask queue flushes after the microstask queue.
 * @returns A Promise for its return value
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
 * @see setTimeout
 */
export function macroq(fn: Function) {
  return new Promise(resolve => {
    return setTimeout(() => resolve(fn()), 0);
  });
}
