import {
  of,
  from,
  defer,
  NEVER,
  timer,
  Observable,
  throwError,
  empty,
  concat,
} from 'rxjs';
import {
  map,
  mergeMap,
  concatMap,
  exhaustMap,
  switchMap,
} from 'rxjs/operators';
import { AwaitableObservable, ConcurrencyMode, Listener, Thunk } from './types';
import { toggleMap } from './toggleMap';
export { toggleMap } from './toggleMap';
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
export function after<T>(
  ms: number,
  objOrFn?: T | Thunk<T>
): AwaitableObservable<T> {
  const delay = ms <= 0 ? of(0) : ms === Infinity ? NEVER : timer(ms);

  const resultObs: Observable<T> = delay.pipe(
    // @ts-ignore
    map(() => (typeof objOrFn === 'function' ? objOrFn() : objOrFn))
  );

  // after is a 'thenable, thus usable with await.
  // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
  // @ts-ignore
  resultObs.then = function(resolve, reject) {
    return resultObs.toPromise().then(resolve, reject);
  };
  // @ts-ignore
  return resultObs;
}

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

const getTimestamp = () => new Date().getTime();

/** Returns a Promise for the point in time at which all existing queued microtasks (e.g. Promise.resolve()) have completed. */
export function microflush(): Promise<number> {
  return Promise.resolve().then(() => getTimestamp());
}

/** Returns a Promise for the point in time at which all existing queued macrotasks (e.g. setTimeout 0) have completed. */
export function macroflush(): Promise<number> {
  return new Promise(resolve => {
    return setTimeout(() => resolve(getTimestamp()), 0);
  });
}

/** Decorates a function so that its argument is the mutable array
 * of all events seen during its run. Useful for testing:
 *
 * it('does awesome', captureEvents(async seen => {
 *  trigger('foo)
 *  expect(seen).toEqual([{type: 'foo'}])
=======
/** Decorates a function so that its argument is the mutable array
 * of all events seen during its run. Useful for testing:
 *
 * it('does awesome', captureEvents(async seen => {
 *  trigger('foo)
 *  expect(seen).toEqual([{type: 'foo'}])
>>>>>>> 481c16a... 1.1.5 export captureEvents testing helper. TS fix for issue #22
 * }));
=======
/** Creates a derived Observable, running the listener in the given ConcurrencyMode
 * turning sync errors into Observable error notifications
>>>>>>> 1c792da... 1.2.0 Smaller Bundle, More Robust, Type-safe
 */
export function combineWithConcurrency<T, U>(
  o: Observable<T>,
  listener: Listener<T, U>,
  mode: ConcurrencyMode,
  individualPipes = [],
  individualEnder = empty(),
  individualStarter = () => empty()
) {
  const combine = operatorForMode(mode);
  const mappedEvents = (e: T): Observable<U> => {
    try {
      const _results = listener(e);
      // @ts-ignore
      return concat(
        // @ts-ignore
        individualStarter(e),
        // @ts-ignore
        toObservable<U>(_results).pipe(...individualPipes),
        individualEnder
      );
    } catch (ex) {
      return throwError(ex);
    }
  };
  const combined = o.pipe(
    // @ts-ignore
    combine(mappedEvents)
  );
  return combined;
}

/** Controls what types can be returned from an `on` handler:
    Primitive types: `of()`
    Promises: `from()`
    Observables: pass-through
*/
function toObservable<T>(_results: any): Observable<T> {
  if (typeof _results === 'undefined') return empty();

  if (typeof _results === 'function') {
    return _results.length === 1 ? new Observable(_results) : defer(_results);
  }

  // An Observable is preferred
  if (_results.subscribe) return _results;

  // A Subscrition is ok - can be canceled but not awaited
  if (_results.unsubscribe)
    return new Observable(() => {
      // an Observable's return value is its cleanup function
      return () => _results.unsubscribe();
    });

  // A Promise  is acceptable
  if (_results.then) return from(_results as Promise<T>);

  // All but string iterables will be expanded (generators, arrays)
  if (
    typeof _results[Symbol.iterator] === 'function' &&
    typeof _results !== 'string'
  )
    return from(_results as Generator<T>);

  // otherwise we convert it to a single-item Observable
  return of(_results);
}

export function operatorForMode(mode: ConcurrencyMode = ConcurrencyMode.parallel) {
  switch (mode) {
    case ConcurrencyMode.ignore:
      return exhaustMap;
    case ConcurrencyMode.parallel:
      return mergeMap;
    case ConcurrencyMode.serial:
      return concatMap;
    case ConcurrencyMode.toggle:
      return toggleMap;
    case ConcurrencyMode.replace:
    default:
      return switchMap;
  }
}
