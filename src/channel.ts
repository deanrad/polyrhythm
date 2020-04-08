import { Subject, Observable, Subscription } from 'rxjs';
import { filter as _filter, takeUntil } from 'rxjs/operators';
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

export class Channel {
  private channel: Subject<Event>;
  private filters: Map<Predicate, Filter>;
  private listeners: Map<Predicate, Listener>;
  private listenerEnders: Map<Predicate, Subject>;

  constructor() {
    this.channel = new Subject<Event>();
    this.filters = new Map<Predicate, Filter>();
    this.listeners = new Map<Predicate, Listener>();
    this.listenerEnders = new Map<Predicate, Subject>();
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

  public listen(eventMatcher: EventMatcher, listener: Listener) {
    const predicate = getEventPredicate(eventMatcher);
    const ender = new Subject();
    this.listenerEnders.set(predicate, ender);

    const canceler = new Subscription(() => {
      this.deactivateListener(predicate);
    });

    const safeListen = (event: Event) => {
      try {
        const retVal = listener(event);
        if (retVal.subscribe) {
          const selfEnding = retVal.pipe(takeUntil(ender));
          selfEnding.subscribe();
        }
      } catch (e) {
        canceler.unsubscribe();
      }
    };
    this.listeners.set(predicate, safeListen);
    return canceler;
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
    this.listenerEnders.get(predicate).next();
  }
}

// Exports for a default Channel
export const channel = new Channel();
export const trigger = channel.trigger.bind(channel);
export const query = channel.query.bind(channel);
export const filter = channel.filter.bind(channel);
export const listen = channel.listen.bind(channel);
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
