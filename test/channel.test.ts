import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Observable, Subscription, BehaviorSubject } from 'rxjs';
import { scan } from 'rxjs/operators';
import {
  trigger,
  query,
  filter,
  reset,
  Event,
  EventMatcher,
  Filter,
} from '../src/channel';
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

require('clear')();

describe('Sequences of Methods', () => {
  const event = { type: 'anytype', payload: randomId() };
  const triggerEvent = () => {
    trigger(event.type, event.payload);
  };
  beforeEach(function () {
    reset();
  });
  afterEach(function () {
    this.unsubscribe && this.unsubscribe();
  });

  describe('#trigger', () => {
    it('creates and returns the event', () => {
      const result = trigger('etype', {});
      const expected = { type: 'etype', payload: {} };
      expect(result).to.eql(expected);
    });
  });

  describe('#query', () => {
    it('returns an Observable of events', () => {
      const result = query(true);

      expect(result).to.be.instanceOf(Observable);
    });
  });

  describe('#filter', () => {
    it('returns a subscription', () => {
      const result = filter(true, () => null);

      expect(result).to.be.instanceOf(Subscription);
    });
  });

  describe('#trigger, #query', () => {
    it('does not find events triggered before the query');
  });

  describe('#query, #trigger', () => {
    it('finds events triggered after the query', function () {
      const eventMatcher = true;

      const seen = eventsMatching(eventMatcher, this);

      // trigger events
      const event2 = { type: 'e2', payload: randomId() };
      trigger(event.type, event.payload);
      trigger(event2.type, event2.payload);

      expect(seen.value).to.eql([event, event2]);
    });
  });

  describe('#filter, #trigger', () => {
    let callCount = 0;
    const thrower: Filter = (e: Event) => {
      callCount++;
      takesException(e);
    };

    beforeEach(() => (callCount = 0));

    it('can throw for the triggerer', () => {
      filter(true, takesException);
      expect(() => {
        trigger(event.type, event.payload);
      }).to.throw();
    });

    it('can throw and resume taking events', () => {
      filter(true, thrower);
      expect(triggerEvent).to.throw();
      expect(callCount).to.equal(1);
      expect(triggerEvent).to.throw();
      expect(callCount).to.equal(2);
    });

    it('can modify the event', () => {
      filter(true, mutator);
      const result = trigger(event.type, event.payload);
      expect(result).to.have.property('mutantProp', ':)');
    });
  });
  
  describe('#filter, #trigger, #filter.unsubscribe', () => {
    it('stops filtering events', () => {
      let sub = filter(true, mutator);
      let result = trigger(event.type, event.payload);
      expect(result).to.have.property('mutantProp', ':)');

      sub.unsubscribe();
      result = trigger(event.type, event.payload);
      expect(result).not.to.have.property('mutantProp', ':)');
    });
  });
});

const takesException: Filter = (e: Event) => {
  throw new Error(`Error: ${randomId()}`);
};

const mutator: Filter = (e: Event) => {
  // @ts-ignore
  e.mutantProp = ':)';
};
