import { Subject, Observable, Subscription, of, from, concat } from 'rxjs';
import { filter as _filter, tap, takeUntil } from 'rxjs/operators';
import { mergeMap, concatMap, exhaustMap, switchMap } from 'rxjs/operators';
import { toggleMap } from './toggleMap';
export { toggleMap } from './toggleMap';
export { Subscription } from 'rxjs';

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
 * When a listener is async, returning an Observable, it's possible
 * that a previous Observable of that listener is running already.
 * Concurrency modes control how the new and old listener are affected
 * when when they overlap.
 *
 * ![concurrency modes](https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png)
 */
export enum ConcurrencyMode {
  /**
   * Newly returned Observables are subscribed immediately, without regard to resource constraints, or the ordering of their completion. (ala mergeMap) */
  parallel = 'parallel',
  /**
   * Observables are enqueued and always complete in the order they were triggered. (ala concatMap)*/
  serial = 'serial',
  /**
   * Any existing Observable is canceled, and a new is begun (ala switchMap) */
  replace = 'replace',
  /**
   * Any new Observable is not subscribed if another is running. (ala exhaustMap) */
  ignore = 'ignore',
  /**
   * Any new Observable is not subscribed if another is running, and
   * the previous one is canceled. (ala switchMap with empty() aka toggleMap) */
  toggle = 'toggle',
}

export interface TriggerConfig {
  next?: string;
  complete?: string;
  error?: string;
}

export interface ListenerConfig {
  /** The concurrency mode to use. Governs what happens when another handling from this handler is already in progress. */
  mode?: ConcurrencyMode;
  /** A declarative way to map the Observable returned from the listener onto new triggered events */
  trigger?: TriggerConfig;
}

export class Channel {
  private channel: Subject<Event>;
  private filters: Map<Predicate, Filter>;
  private listeners: Map<Predicate, Listener>;
  private listenerEnders: Map<Predicate, Subject<any>>;
  private listenerParts: Map<Predicate, Subject<any>>;
  public errors: Subject<string | Error>;

  constructor() {
    this.channel = new Subject<Event>();
    this.filters = new Map<Predicate, Filter>();
    this.listeners = new Map<Predicate, Listener>();
    this.listenerEnders = new Map<Predicate, Subject<any>>();
    this.listenerParts = new Map<Predicate, Subject<any>>();
    this.errors = new Subject<string | Error>();
    if (process?.env?.NODE_ENV !== 'test') {
      this.errors.subscribe(e => console.error(e));
    }
  }

  public trigger(type: string, payload?: any): Event {
    const event = { type };
    payload && Object.assign(event, { payload });

    for (const [predicate, filter] of this.filters.entries()) {
      predicate(event) && filter(event);
    }

    Object.freeze(event);
    this.channel.next(event);

    for (const [predicate, listener] of this.listeners.entries()) {
      if (predicate(event)) {
        listener(event);
      }
    }

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
    const userTriggers = getUserTriggers(config.trigger);

    const ender = new Subject();
    const parts = new Subject();
    this.listenerEnders.set(predicate, ender);
    this.listenerParts.set(predicate, parts);

    const canceler = new Subscription(() => {
      this.deactivateListener(predicate);
    });

    const enqueuePart = (event: Event) => {
      try {
        const userReturned = toObservable(listener(event));
        const part = concat(userReturned, applyCompleteTrigger());
        parts.next(part);
      } catch (e) {
        this.errors.next(e);
        this.errors.next(
          `A listener function threw an exception and will be unsubscribed`
        );
        canceler.unsubscribe();
      }
    };

    const applyNextTrigger = (e: any) => {
      userTriggers.next && this.trigger(userTriggers.next, e);
    };
    const applyCompleteTrigger = () => {
      return new Observable(notify => {
        userTriggers.complete && this.trigger(userTriggers.complete);
        notify.complete();
      });
    };

    const applyOverlap: any = operatorForMode(config.mode);

    const listenerEvents = parts.pipe(
      applyOverlap((part: any) => part),
      tap(applyNextTrigger),
      takeUntil(ender)
    );

    const listenerObserver = {
      error: (err: Error) => {
        this.errors.next(err);
        this.errors.next(
          `A listener function notified with an error and will be unsubscribed`
        );
        canceler.unsubscribe();
        if (userTriggers.error) {
          this.trigger(userTriggers.error, err);
        }
      },
    };

    const listenerSub = listenerEvents.subscribe(listenerObserver);
    canceler.add(() => listenerSub.unsubscribe());

    this.listeners.set(predicate, enqueuePart);
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

function getUserTriggers(config: TriggerConfig = {}) {
  return config;
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

function operatorForMode(mode: ConcurrencyMode = ConcurrencyMode.parallel) {
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
