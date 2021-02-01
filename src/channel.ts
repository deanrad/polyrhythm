import { Subject, Observable, Subscription, empty, throwError } from 'rxjs';
import isMatch from 'lodash.ismatch';
import { catchError, filter as _filter, map, mergeMap } from 'rxjs/operators';
import { takeUntil, first } from 'rxjs/operators';
import { combineWithConcurrency } from './utils';
import {
  Predicate,
  Filter,
  Event,
  EventWithAnyFields,
  EventWithResult,
  EventMatcher,
  Listener,
  ListenerConfig,
} from './types';

function isTestMode() {
  if (typeof process === 'undefined') return false;
  return process?.env?.NODE_ENV === 'test';
}
const MSG_LISTENER_ERROR = `A listener function notified with an error and will be unsubscribed`;

export class Channel {
  private eventChannel: Subject<Event>;
  private resets: Subject<void>;
  private filters: Map<Predicate, Filter<any>>;
  public errors: Subject<string | Error>;

  constructor() {
    this.eventChannel = new Subject<Event>();
    this.filters = new Map<Predicate, Filter<Event>>();
    this.resets = new Subject<void>();
    this.errors = new Subject<string | Error>();
    if (!isTestMode()) {
      this.errors.subscribe(e => console.error(e));
    }
  }

  public trigger<T>(
    eventOrType: string | (EventWithAnyFields & T),
    payload?: T
  ): EventWithResult {
    const event: EventWithResult =
      typeof eventOrType === 'string'
        ? { type: eventOrType as string }
        : eventOrType;
    payload && Object.assign(event, { payload });

    for (const [predicate, filter] of this.filters.entries()) {
      if (predicate(event)) {
        filter(event);
      }
    }

    Object.freeze(event);

    this.eventChannel.next(event);
    return event;
  }

  public filter<T extends Event>(
    eventMatcher: EventMatcher,
    f: Filter<T>
  ): Subscription {
    const predicate = getEventPredicate(eventMatcher);
    this.filters.set(predicate, f);
    return new Subscription(() => {
      this.filters.delete(predicate);
    });
  }

  public listen<T extends Event, U>(
    eventMatcher: EventMatcher,
    listener: Listener<T, U>,
    config: ListenerConfig = {}
  ): Subscription {
    const userTriggers = config.trigger || {};
    const individualPipes = [];
    // @ts-ignore
    if (userTriggers.next) {
      individualPipes.push(
        mergeMap(e => {
          try {
            // @ts-ignore
            this.trigger(userTriggers.next, e);
            return empty();
          } catch (ex) {
            return throwError(new Error(MSG_LISTENER_ERROR));
          }
        })
      );
    }
    // @ts-ignore
    if (userTriggers.error) {
      individualPipes.push(
        catchError(
          e =>
            new Observable(notify => {
              // @ts-ignore
              this.trigger(userTriggers.error, e);
              notify.complete();
            })
        )
      );
    }
    // allow declarative termination
    if (config.takeUntil) {
      individualPipes.push(takeUntil(this.query(config.takeUntil)));
    }
    // @ts-ignore
    const individualEnder: Observable<any> = userTriggers.complete
      ? new Observable(o => {
          // @ts-ignore
          this.trigger(userTriggers.complete);
          o.complete();
        })
      : empty();
    const _combined = combineWithConcurrency<T, U>(
      this.query(eventMatcher),
      listener,
      // @ts-ignore
      config.mode,
      individualPipes,
      individualEnder
    );

    const listenerObserver = {
      error: (err: Error) => {
        this.errors.next(err);
        this.errors.next(MSG_LISTENER_ERROR);
      },
    };

    const combined = _combined.pipe(takeUntil(this.resets));
    return combined.subscribe(listenerObserver);
  }

  /* An alias for listen, hat tip to JQuery. */
  public on<T extends Event, U>(
    eventMatcher: EventMatcher,
    listener: Listener<T, U>,
    config: ListenerConfig = {}
  ): Subscription {
    return this.listen(eventMatcher, listener, config);
  }

  /**
   * Provides an Observable of matching events from the channel.
   */
  public query<T extends Event>(
    eventMatcher: EventMatcher,
    payloadMatcher?: Object
  ): Observable<T> {
    const resultObs = this.eventChannel.asObservable().pipe(
      _filter(getEventPredicate(eventMatcher, payloadMatcher)),
      map(e => e as T)
    );

    resultObs.toPromise = function() {
      return resultObs.pipe(first()).toPromise();
    };
    // @ts-ignore
    resultObs.then = function(resolve, reject) {
      return resultObs.toPromise().then(resolve, reject);
    };
    return resultObs;
  }

  /** Runs a filter function (sync) for all events on a channel */
  public spy<T extends Event>(spyFn: Filter<T>) {
    const sub = this.filter(true, (e: T) => {
      try {
        spyFn(e);
      } catch (err) {
        this.errors.next(err);
        this.errors.next(`A spy threw an exception and will be unsubscribed`);
        if (sub) {
          sub.unsubscribe();
        }
      }
    });
    return sub;
  }
  /**
   * Clears all filters and listeners, and cancels any in-flight
   * async operations by listeners.
   */
  public reset() {
    this.filters.clear();
    this.resets.next();
  }
}

// Exports for a default Channel
export const channel = new Channel();
export const trigger = channel.trigger.bind(channel);
export const query = channel.query.bind(channel);
export const filter = channel.filter.bind(channel);
export const listen = channel.listen.bind(channel);
export const on = channel.on.bind(channel);
export const spy = channel.spy.bind(channel);
export const reset = channel.reset.bind(channel);

function getEventPredicate(
  eventMatcher: EventMatcher,
  payloadMatcher?: Object
) {
  let predicate: (event: Event) => boolean;

  if (eventMatcher instanceof RegExp) {
    predicate = (event: Event) =>
      eventMatcher.test(event.type) &&
      (!payloadMatcher || isMatch(event.payload, payloadMatcher));
  } else if (eventMatcher instanceof Function) {
    predicate = eventMatcher;
  } else if (typeof eventMatcher === 'boolean') {
    predicate = () => eventMatcher;
  } else if (typeof eventMatcher === 'object') {
    predicate = (event: Event) => isMatch(event, eventMatcher);
  } else if (eventMatcher.constructor === Array) {
    predicate = (event: Event) =>
      (eventMatcher as Array<string>).includes(event.type) &&
      (!payloadMatcher || isMatch(event.payload, payloadMatcher));
  } else {
    predicate = (event: Event) =>
      eventMatcher === event.type &&
      (!payloadMatcher || isMatch(event.payload, payloadMatcher));
  }
  return predicate;
}

/** Decorates a function so that its argument is the mutable array
 * of all events seen during its run. Useful for testing:
 *
 * it('does awesome', captureEvents(async seen => {
 *  trigger('foo)
 *  expect(seen).toEqual([{type: 'foo'}])
 * }));
 */
export function captureEvents<T>(testFn: (arg: T[]) => void | Promise<any>) {
  return function() {
    const seen = new Array<T>();
    // @ts-ignore
    const sub = query(true).subscribe(event => seen.push(event));
    const result: any = testFn(seen);
    if (result && result.then) {
      return result.finally(() => sub.unsubscribe());
    }
    sub.unsubscribe();
    return result;
  };
}
