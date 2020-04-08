import { expect } from 'chai';
import { describe, it } from 'mocha';
import { BehaviorSubject } from 'rxjs';
import { scan } from 'rxjs/operators';
import { trigger, query, Event, EventMatcher } from '../src/channel';
import { randomId } from '../src/utils';

function eventsMatching(
  eventMatcher: EventMatcher,
  example: any
): BehaviorSubject<Array<Event>> {
  const seen = new BehaviorSubject<Array<Event>>([]);
  const sub = query(eventMatcher)
    .pipe(scan((a, i) => [...a, i], new Array<Event>()))
    .subscribe(seen);

  // can clean up with an afterEach
  example.unsubscribe = () => {
    sub.unsubscribe();
  };
  return seen;
}

//require('clear')();
describe('Sanity', () => {
  it('is non-null', () => {
    expect(1 + 1).to.equal(2);
  });
});

describe('#trigger', () => {
  it('returns the event', () => {
    const result = trigger('etype', {});
    const expected = { type: 'etype', payload: {} };
    expect(result).to.eql(expected);
  });
});

// describe('#query', () => {
//   it('returns an Observable of events');
// });

describe('#query > #trigger', () => {
  const event = { type: 'anytype', payload: randomId() };

  afterEach(function () {
    this.unsubscribe && this.unsubscribe();
  });

  it('finds events triggered later', function () {
    const eventMatcher = true;

    const seen = eventsMatching(eventMatcher, this);

    // trigger events
    const event2 = { type: 'e2', payload: randomId() };
    trigger(event.type, event.payload);
    trigger(event2.type, event2.payload);

    expect(seen.value).to.eql([event, event2]);
  });
});

describe('#trigger > #query', () => {
  it('does not find events triggered before');
});
