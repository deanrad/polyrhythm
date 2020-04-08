import { Subject, Observable, Subscription, of, from } from 'rxjs';
import { filter as _filter, takeUntil } from 'rxjs/operators';
import { mergeMap, concatMap, exhaustMap, switchMap } from 'rxjs/operators';
export { Subscription } from 'rxjs';
import { toggleMap } from './toggleMap';

export interface Event {
  type: string;
  payload?: any;
  error?: boolean;
  meta?: Object;
}

/* A function that can be used as an EventMatcher. */
export interface Predicate {
  (item: Event): boolean;
}

export type EventMatcher = string | string[] | RegExp | Predicate | boolean;

/**
 * A Filter runs a synchronous function prior to any listeners
 * being invoked, and can cancel future filters, and all listeners
 * by throwing an exception, which must be caught by the caller of
 * `trigger`.
 *
 * It does *not*, as its name suggest, split off a slice of the
 * stream. To do that see `query`.
 * @see query
 */
export interface Filter {
  (item: Event): any;
}

/**
 * The function you assign to `.on(eventType, fn)`
 * events is known as a Listener. It receives the event.
 */
export interface Listener {
  (item: Event): any;
}

/**
 * When a handler (async usually) returns an Observable, it's possible
 * that another handler for that type is running already (see demo 'speak-up').
 * The options are:
 * - parallel: Concurrent handlers are unlimited, unadjusted
 * - serial: Concurrency of 1, handlers are queued
 * - cutoff: Concurrency of 1, any existing handler is killed
 * - mute: Concurrency of 1, existing handler prevents new handlers
 * - toggle: Concurrency of 1, kill existing, otherwise start anew
 *
 * ![concurrency modes](https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png)
 */
export enum ConcurrencyMode {
  /**
   * Handlers are invoked asap - no limits */
  parallel = 'parallel',
  /**
   * Concurrency of 1, handlers are enqueued */
  serial = 'serial',
  /**
   * Concurrency of 1, any existing handler is killed while a new is started */
  replace = 'replace',
  /**
   * Concurrency of 1, existing handler prevents new handlers */
  ignore = 'ignore',
  /**
   * Concurrency of 1, existing handler is canceled, and prevents new handlers */
  toggle = 'toggle',
}

export interface ListenerConfig {
  /** The concurrency mode to use. Governs what happens when another handling from this handler is already in progress. */
  mode?: ConcurrencyMode;
}

export class Channel {
  private channel: Subject<Event>;
  private filters: Map<Predicate, Filter>;
  private listeners: Map<Predicate, Listener>;
  private listenerEnders: Map<Predicate, Subject<any>>;
  private listenerParts: Map<Predicate, Subject<any>>;

  constructor() {
    this.channel = new Subject<Event>();
    this.filters = new Map<Predicate, Filter>();
    this.listeners = new Map<Predicate, Listener>();
    this.listenerEnders = new Map<Predicate, Subject<any>>();
    this.listenerParts = new Map<Predicate, Subject<any>>();
  }

  public trigger(type: string, payload?: any): Event {
    const event = { type };
    payload && Object.assign(event, { payload });

    for (const [predicate, filter] of this.filters.entries()) {
      predicate(event) && filter(event);
    }

    Object.freeze(event);

    for (const [predicate, listener] of this.listeners.entries()) {
      if (predicate(event)) {
        listener(event);
      }
    }
    this.channel.next(event);
    return event;
  }

  public query(eventMatcher: EventMatcher): Observable<Event> {
    return this.channel
      .asObservable()
      .pipe(_filter(getEventPredicate(eventMatcher)));
  }

  public filter(eventMatcher: EventMatcher, f: Filter) {
    const predicate = getEventPredicate(eventMatcher);
    this.filters.set(predicate, f);
    return new Subscription(() => {
      this.filters.delete(predicate);
    });
  }

  public listen(
    eventMatcher: EventMatcher,
    listener: Listener,
    config: ListenerConfig = {}
  ) {
    const predicate = getEventPredicate(eventMatcher);
    const ender = new Subject();
    const parts = new Subject();
    this.listenerEnders.set(predicate, ender);
    this.listenerParts.set(predicate, parts);

    const canceler = new Subscription(() => {
      this.deactivateListener(predicate);
    });

    const safeListen = (event: Event) => {
      try {
        const retVal = listener(event);
        parts.next(retVal);
      } catch (e) {
        canceler.unsubscribe();
      }
    };
    const op: any = operatorForMode(config.mode || ConcurrencyMode.parallel);
    const sub = parts
      .pipe(
        op((retVal: any) => toObservable(retVal)),
        takeUntil(ender)
      )
      .subscribe();
    canceler.add(() => sub.unsubscribe());

    this.listeners.set(predicate, safeListen);
    return canceler;
  }

  public on(
    eventMatcher: EventMatcher,
    listener: Listener,
    config: ListenerConfig = {}
  ) {
    return listen(eventMatcher, listener, config);
  }

  public reset() {
    this.filters.clear();
    for (let listenerPredicate of this.listeners.keys()) {
      this.deactivateListener(listenerPredicate);
    }
  }

  private deactivateListener(predicate: Predicate) {
    // unregister from future effects
    this.listeners.delete(predicate);
    // cancel any in-flight
    const ender = this.listenerEnders.get(predicate);
    ender && ender.next();
    this.listenerEnders.delete(predicate);
  }
}

// Exports for a default Channel
export const channel = new Channel();
export const trigger = channel.trigger.bind(channel);
export const query = channel.query.bind(channel);
export const filter = channel.filter.bind(channel);
export const listen = channel.listen.bind(channel);
export const on = channel.on.bind(channel);
export const reset = channel.reset.bind(channel);

function getEventPredicate(eventMatcher: EventMatcher) {
  let predicate: (event: Event) => boolean;

  if (eventMatcher instanceof RegExp) {
    predicate = (event: Event) => eventMatcher.test(event.type);
  } else if (eventMatcher instanceof Function) {
    predicate = eventMatcher;
  } else if (typeof eventMatcher === 'boolean') {
    predicate = () => eventMatcher;
  } else if (eventMatcher.constructor === Array) {
    predicate = (event: Event) => eventMatcher.includes(event.type);
  } else {
    predicate = (event: Event) => eventMatcher === event.type;
  }
  return predicate;
}

/** Controls what types can be returned from an `on` handler:
    Primitive types: `of()`
    Promises: `from()`
    Observables: pass-through
*/
function toObservable(_results: any) {
  if (typeof _results === 'undefined') return of(undefined);

  // An Observable is preferred
  if (_results.subscribe) return _results;

  // A Promise is acceptable
  if (_results.then) return from(_results);

  // otherwiser we convert it to a single-item Observable
  return of(_results);
}

function operatorForMode(mode: ConcurrencyMode) {
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
