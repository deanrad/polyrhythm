import { Observable, Subscriber } from 'rxjs';
export { Subscriber, Subscription } from 'rxjs';

export interface Event {
  type: string;
  payload?: any;
}
export interface EventWithAnyFields extends Event {
  [others: string]: any;
}
export interface EventWithResult extends Event {
  result?: Promise<any>;
}
/* A function that can be used as an EventMatcher. */
export interface Predicate {
  (item: Event): boolean;
}

export interface AwaitableObservable<T> extends PromiseLike<T>, Observable<T> {}

export type EventMatcher = string | string[] | RegExp | Predicate | boolean;

interface PromiseFactory<T> {
  (): Promise<T>;
}
interface ObservableConstructorFn<T> {
  (notify: Subscriber<T>): void | Function;
}

export type EffectDescriptor<T> =
  | Promise<T>
  | PromiseFactory<T>
  | AwaitableObservable<T>
  | Generator<T>
  | Observable<T>
  | ObservableConstructorFn<T>;

/**
 * A Filter runs a synchronous function prior to any listeners
 * being invoked, and can cancel future filters, and all listeners
 * by throwing an exception, which must be caught by the caller of
 * `trigger`.
 *
 * It does *not*, as its name might suggest, split off a slice of the
 * stream. To do that see `query`.
 * @see query
 */
export interface Filter<T> {
  (item: T): void;
}

/**
 * The function you assign to `.on(eventType, fn)`
 * events is known as a Listener. It receives the event.
 */
export interface Listener<T, U> {
  (item: T): void | any | EffectDescriptor<U>;
}

/**
 * When a listener is async, returning an Observable, it's possible
 * that a previous Observable of that listener is running already.
 * Concurrency modes control how the new and old listener are affected
 * when when they overlap.
 *
 * ![concurrency modes](https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png)
 */
export enum ConcurrencyMode {
  /**
   * Runs an async process in 'parallel' or 'mergeMap' mode.
   *
   * For 'parallel' mode, if triggers 1 and 2 begin overlapping async processes,
   * marked by start:N and done:N events, the following order will occur:
   *
   * ```
   * start:1
   * start:2
   * done:1 // done in either order
   * done:2
   * ```
   * */
  parallel = 'parallel',
  /**
   * Runs an async process in 'serial' or 'concatMap' mode.
   *
   * For 'serial' mode, if triggers 1 and 2 begin overlapping async processes,
   * marked by start:N and done:N events, the following order will occur:
   *
   * ```
   * start:1
   * done:1
   * start:2
   * done:2
   * ```
   * */
  serial = 'serial',
  /**
   * Runs an async process in 'replace' or 'switchMap' mode.
   *
   * For 'replace' mode, if triggers 1 and 2 begin overlapping async processes,
   * marked by start:N and done:N events, the following order will occur:
   *
   * ```
   * start:1
   * start:2  // process 1 canceled
   * done:2
   * ```
   * */
  replace = 'replace',
  /**
   *
   * Runs an async process in 'ignore' or 'exhaustMap' mode.
   *
   * For 'ignore' mode, if triggers 1 and 2 begin overlapping async processes,
   * marked by start:N and done:N events, the following order will occur:
   *
   * ```
   * start:1
   * done:1  // process 2 not started
   * ```
   * */
  ignore = 'ignore',
  /**
   * Runs an async process in 'toggle' mode.
   *
   * For 'toggle' mode, if triggers 1 and 2 begin overlapping async processes,
   * marked by start:N and done:N events, the following order will occur:
   *
   * ```
   * start:1 // process 1 canceled by trigger 2, unstarted as well
   * ```
   * */
  toggle = 'toggle',
}

export interface TriggerConfig {
  next?: string;
  complete?: string;
  error?: string;
  start?: string;
}

export interface ListenerConfig {
  /** The concurrency mode to use. Governs what happens when another handling from this handler is already in progress. */
  mode?:
    | ConcurrencyMode
    | 'serial'
    | 'parallel'
    | 'replace'
    | 'ignore'
    | 'toggle';
  /** A declarative way to map the Observable returned from the listener onto new triggered events */
  trigger?: TriggerConfig | true;
  takeUntil?: EventMatcher;
}

export interface Thunk<T> {
  (): T;
}
