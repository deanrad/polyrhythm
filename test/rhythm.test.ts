import { expect } from 'chai';
import { concat, of, Subscription } from 'rxjs';
import sinon from 'sinon';
import { fakeSchedulers } from 'rxjs-marbles/mocha';
import { channel } from '../src/channel';
import { after } from '../src/utils';
import { Event } from '../src/types';

const mockUser = { id: 42, name: 'Joe' };

let DELAY = 5000;

describe('User Rhythm', () => {
  let channelEvents: Event[];
  let cleanup: Subscription;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    channelEvents = new Array<Event>();
    // tests can add cleanup functions to this object
    cleanup = new Subscription();
    cleanup.add(channel.filter(true, e => channelEvents.push(e)));
    clock = sinon.useFakeTimers();
  });

  beforeEach(() => {
    // Our test subject is a channel set up to
    // respond to certain events. We Assert upon events
    // the channel sees, and Arrange and Act by triggering
    // events according to an Observable
    channel.listen('REQUEST_USER', () => of(mockUser), {
      trigger: { next: 'RECEIVE_USER' },
    });

    channel.listen('REQUEST_USER_DELAY', () => after(DELAY, mockUser), {
      trigger: { next: 'RECEIVE_USER' },
    });

    channel.listen('REQUEST_USER_DEBOUNCED', () => after(DELAY, mockUser), {
      trigger: { next: 'RECEIVE_USER' },
      mode: 'replace',
    });
  });

  afterEach(() => {
    // run any unsubscribers - tests should do cleanup.add for cleanup
    cleanup.unsubscribe();
    // and simply
    channel.reset();
    clock?.restore();
  });

  it('maps REQUEST_USER to RECEIVE_USER', () => {
    // declare inputs
    const request = { type: 'REQUEST_USER' };
    const input = of(request);

    // define outputs
    const output = [
      request,
      {
        type: 'RECEIVE_USER',
        payload: mockUser,
      },
    ];

    // run the inputs
    input.subscribe(e => channel.trigger(e));

    // assert the outputs
    expect(channelEvents).to.eql(output);
  });

  it(
    'maps REQUEST_USER_DELAY to RECEIVE_USER',
    fakeSchedulers(() => {
      // declare inputs
      const request = { type: 'REQUEST_USER_DELAY' };
      const input = of(request);

      // run the inputs
      input.subscribe(e => channel.trigger(e));

      // sync events are seen
      expect(channelEvents).to.eql([request]);

      // advance time virtually
      clock.tick(DELAY);

      // assert all events
      expect(channelEvents).to.eql([
        request,
        {
          type: 'RECEIVE_USER',
          payload: mockUser,
        },
      ]);
    })
  );

  it(
    'maps debounced REQUEST_USER to RECEIVE_USER',
    fakeSchedulers(() => {
      // declare inputs
      const request = { type: 'REQUEST_USER_DEBOUNCED' };
      const input = of(request, request);

      // run the inputs
      input.subscribe(e => channel.trigger(e));

      // advance time virtually, with sufficient margin
      clock.tick(DELAY * 10);

      // assert the outputs - 2 requests, one output
      expect(channelEvents).to.eql([
        request,
        request,
        {
          type: 'RECEIVE_USER',
          payload: mockUser,
        },
      ]);
    })
  );

  it(
    'maps debounced REQUEST_USER to RECEIVE_USER over time',
    fakeSchedulers(() => {
      // declare inputs
      const request = { type: 'REQUEST_USER_DEBOUNCED' };
      const input = concat(after(0, request), after(DELAY * 0.5, request));

      // run the inputs
      input.subscribe(e => channel.trigger(e));

      // advance time virtually, with sufficient margin
      clock.tick(DELAY * 10);

      // assert the outputs - 2 requests, one output
      expect(channelEvents).to.eql([
        request,
        request,
        {
          type: 'RECEIVE_USER',
          payload: mockUser,
        },
      ]);
    })
  );
});
