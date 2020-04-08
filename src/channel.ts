import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

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

export class Channel {
  private channel: Subject<Event>;
  constructor() {
    this.channel = new Subject<Event>();
  }
  public trigger(type: string, payload?: any): Event {
    const event = { type, payload };
    this.channel.next(event);
    return event;
  }
  public query(eventMatcher: EventMatcher): Observable<Event> {
    return this.channel
      .asObservable()
      .pipe(filter(getEventPredicate(eventMatcher)));
  }
}

export const channel = new Channel();

export const { trigger, query } = {
  trigger: channel.trigger.bind(channel),
  query: channel.query.bind(channel),
};

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
