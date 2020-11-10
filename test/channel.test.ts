import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  Observable,
  Subscription,
  BehaviorSubject,
  range,
  asyncScheduler,
  throwError,
  of,
} from 'rxjs';
import { eachValueFrom } from 'rxjs-for-await';
import { scan, tap, take } from 'rxjs/operators';
import {
  trigger,
  query,
  filter,
  listen,
  on,
  spy,
  reset,
  channel,
  Channel,
  Event,
  ConcurrencyMode,
  Filter,
} from '../src/channel';
import { randomId, after } from '../src/utils';

function errorsOn(
  channel: Channel,
  example: any
): BehaviorSubject<Array<string | Error>> {
  const seen = new BehaviorSubject<Array<string | Error>>([]);
  example.subscription = channel.errors
    .pipe(scan((a, e) => [...a, e], new Array<string | Error>()))
    .subscribe(seen);
  return seen;
}

function it$(name: string, fn: (arg: Event[]) => void | Promise<any>) {
  it(name, E$(fn));
}

function E$<T>(testFn: (arg: T[]) => void | Promise<any>) {
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

require('clear')();

describe('Sequences of Methods', () => {
  let callCount = 0;
  const thrower: Filter<Event> = (e: Event) => {
    callCount++;
    takesException(e);
  };

  const ill = () => {
    callCount++;
    throw new Error('down wit da sickness');
  };

  const throwsError = () => {
    callCount++;
    return throwError(new Error('Oops'));
  };

  beforeEach(() => {
    reset();
    callCount = 0;
  });
  afterEach(function() {
    if (this.subscription) {
      this.unsubscribe = () => this.subscription.unsubscribe();
    }
    this.unsubscribe && this.unsubscribe();
  });

  describe('#trigger', () => {
    describe('string, payload', () => {
      it('processes and returns the event', () => {
        const result = trigger('etype', {});
        const expected = { type: 'etype', payload: {} };
        expect(result).to.eql(expected);
      });
    });

    describe('object with type field', () => {
      it('processes and returns the event', () => {
        const result = trigger({ type: 'etype', payload: {} });
        const expected = { type: 'etype', payload: {} };
        expect(result).to.eql(expected);
      });
    });

    describe('with 3rd argument resultSpec', () => {
      it('adds a promise for the resulting event to the returned event', async () => {
        const noTime = 0;
        listen('counter/go', ({ payload }) => after(noTime, { ...payload }), {
          trigger: { next: 'counter/tick' },
        });

        const event1 = trigger(
          'counter/go',
          { order: 1 },
          { result: 'counter/tick' }
        );
        const event2 = trigger(
          'counter/go',
          { order: 2 },
          { result: 'counter/tick' }
        );

        // NOTE: In general async listeners will not return the events that
        // corrspond to their triggering events. They'll see the first matching event
        const tick1 = await event1.result;
        const tick2 = await event2.result;
        expect(tick1.payload).to.eql({ order: 1 });
        expect(tick2.payload).to.eql({ order: 2 });
      });
      it('adds a promise for the next matching event to the returned event', async () => {
        const delay = 100;
        listen('counter/go', ({ payload }) => after(delay, { ...payload }), {
          trigger: { next: 'counter/tick' },
        });

        const event1 = trigger(
          'counter/go',
          { order: 1 },
          { result: 'counter/tick' }
        );
        const event2 = trigger(
          'counter/go',
          { order: 2 },
          { result: 'counter/tick' }
        );

        // NOTE: In general async listeners will not return the events that
        // corrspond to their triggering events. They'll see the first matching event
        const tick1 = await event1.result;
        const tick2 = await event2.result;
        expect(tick1.payload).to.eql({ order: 1 });
        expect(tick2.payload).to.eql({ order: 1 });
      });
    });
  });

  describe('#query', () => {
    it('returns an Observable of events', () => {
      const result = query(true);

      expect(result).to.be.instanceOf(Observable);
    });

    describe('.toPromise()', () => {
      it('can be awaited; reply in same callstack', async () => {
        listen('data/query', () => trigger('data/result', 2.5));

        // its important the query for the result be subscribed via toPromise()
        // before the trigger occurs, to acomodate the case of the same callstack
        // Wouldn't work for a sync-triggering listener:
        // const { payload } = trigger('data/query') && (await query('data/result').toPromise());
        const resultEvent = query('data/result').toPromise();
        const { payload } = trigger('data/query') && (await resultEvent);
        expect(payload).to.equal(2.5);
      });

      it('can be awaited; reply in later callstack', async () => {
        listen('auth/login', () => after(1, () => trigger('auth/token', 2.7)));

        const tokenEvent = query('auth/token').toPromise();
        const { payload } = trigger('auth/login') && (await tokenEvent);
        expect(payload).to.equal(2.7);
      });
    });

    it('can be consumed as an async iterator', async () => {
      const seen = [];
      // If we dont force the query to complete, JS will never run
      // code after the for-await loop
      const obs = query(['foo', 'bar']).pipe(take(2));
      const asyncIterator = eachValueFrom(obs);

      after(1, () => trigger('foo')).subscribe();
      after(2, () => trigger('bar')).subscribe();
      for await (let x of asyncIterator) {
        seen.push(x);
      }
      expect(seen).to.eql([{ type: 'foo' }, { type: 'bar' }]);
    });

    describe('inside of a #listen', () => {
      it('misses its own event, of course', async function() {
        let counter = 0;
        listen('count/start', () => {
          query('count/start').subscribe(() => {
            counter++;
          });
        });
        trigger('count/start');
        await delay(10);
        expect(counter).to.equal(0);
      });
    });
  });

  describe('#filter', () => {
    it('returns a subscription', () => {
      const result = filter(true, () => null);

      expect(result).to.be.instanceOf(Subscription);
    });
    it('Should not be given a function which returns a Promise');
  });

  describe('#listen', () => {
    describe('Arguments', () => {
      describe('An Event Pattern', () => {
        it('what events the listener will run upon');
      });

      describe('A Listener  - A function to be run on matching events', () => {
        it('May return nothing or a sync value');
        it('May return an Observable');
        it('May return a Promise');
        describe('May return a Subscription', () => {
          it$('replace: will unsubscribe the previous', async seen => {
            // listener returning a subscription
            listen(
              event.type,
              () => new Subscription(() => trigger('unsubscribe')),
              { mode: ConcurrencyMode.replace }
            );

            triggerEvent();
            triggerEvent();
            triggerEvent();

            const triggered = seen.map(e => e.type);
            expect(triggered).to.eql([
              'anytype',
              'anytype',
              'unsubscribe',
              'anytype',
              'unsubscribe',
            ]);
          });
          it$('toggle: will unsubscribe the previous', async seen => {
            listen(
              event.type,
              () => new Subscription(() => trigger('unsubscribe')),
              { mode: ConcurrencyMode.toggle }
            );

            triggerEvent();
            triggerEvent();
            triggerEvent();

            const triggered = seen.map(e => e.type);
            expect(triggered).to.eql([
              'anytype',
              'anytype',
              'unsubscribe',
              'anytype',
            ]);
          });
          it$(
            'parallel, serial, ignore: will not unsubscribe the previous',
            async seen => {
              listen(
                event.type,
                () => new Subscription(() => trigger('unsubscribe')),
                { mode: ConcurrencyMode.parallel }
              );

              triggerEvent();
              triggerEvent();
              triggerEvent();

              const triggered = seen.map(e => e.type);
              expect(triggered).to.eql(['anytype', 'anytype', 'anytype']);
            }
          );
        });
      });

      describe('Config - concurrency and re-triggering', () => {
        it('See #listen / #trigger specs');
      });
    });

    it('returns a subscription', () => {
      const result = listen(true, () => null);

      expect(result).to.be.instanceOf(Subscription);
    });
  });

  describe('#spy', () => {
    it('runs on every event', () => {
      spy(() => callCount++);
      trigger('foo');
      expect(callCount).to.equal(1);
    });

    describe('When has an error', () => {
      it('is unsubscribed', () => {
        spy(ill);
        trigger('foo'); // errs here
        trigger('foo'); // not counted
        expect(callCount).to.equal(1);
      });
    });
  });

  describe('#trigger, #query', () => {
    it('does not find events triggered before the query', function() {
      let counter = 0;
      trigger('count/start');
      this.subscription = query('count/start').subscribe(() => {
        counter++;
      });
      trigger('count/start');
      expect(counter).to.equal(1);
    });
  });

  describe('#query, #trigger', () => {
    it$('finds events triggered after the query', async seen => {
      // trigger events
      const event2 = { type: 'e2', payload: randomId() };

      trigger(event.type, event.payload);
      trigger(event2.type, event2.payload);

      expect(seen).to.eql([event, event2]);
    });
  });

  describe('#filter, #trigger', () => {
    it('runs synchronously', () => {
      filter(true, () => {
        callCount++;
      });
      trigger('foo');
      expect(callCount).to.equal(1);
    });

    it('can modify the event', () => {
      filter(true, mutator);
      const result = trigger(event.type, event.payload);
      expect(result).to.have.property('mutantProp', ':)');
    });

    it('affects only specified events', () => {
      let bac = 0;
      filter('beer', () => {
        bac += 0.1;
      });
      filter('wine', () => {
        bac += 0.2;
      });
      trigger('wine');
      expect(bac).to.equal(0.2);
    });

    it('can throw for the triggerer', () => {
      filter(true, takesException);
      expect(triggerEvent).to.throw();
    });

    it('can throw and resume taking events', () => {
      filter(true, thrower);
      expect(triggerEvent).to.throw();
      expect(callCount).to.equal(1);
      expect(triggerEvent).to.throw();
      expect(callCount).to.equal(2);
    });
  });

  describe('#filter, #filter, #trigger', () => {
    it('calls filters in order added', () => {
      const doubler = (e: Event) => {
        e.payload *= 2;
      };
      const speaker = (e: Event) => {
        e.payload = `The number is ${e.payload}`;
      };

      filter(true, doubler);
      filter(true, speaker);
      const result = trigger('any', 7);
      expect(result.payload).to.equal('The number is 14');
    });

    it('aborts later filters if earlier ones throw', () => {
      const healthy = () => {
        callCount++;
      };

      filter(true, ill);
      filter(true, healthy);
      expect(triggerEvent).to.throw();
      expect(callCount).to.equal(1);
    });

    it('runs no listeners if an exception thrown', () => {
      let listenerCallCount = 0;
      const healthy = () => {
        listenerCallCount++;
      };

      filter(true, ill);
      listen(true, healthy);
      expect(triggerEvent).to.throw();
      expect(listenerCallCount).to.equal(0);
    });
  });

  describe('#filter, #trigger, #filter.unsubscribe, #trigger', () => {
    it('stops filtering events', () => {
      let sub = filter(true, mutator);
      let result = trigger(event.type, event.payload);
      expect(result).to.have.property('mutantProp', ':)');

      sub.unsubscribe();
      result = trigger(event.type, event.payload);
      expect(result).not.to.have.property('mutantProp', ':)');
    });
  });

  describe('#listen, #trigger', () => {
    it('listener is run only on matching events', () => {
      listen('known-event', () => {
        callCount++;
      });
      trigger('unknown-event');
      expect(callCount).to.equal(0);
    });

    describe('Listener Evaluation and Returning', () => {
      it('listener is evaluated synchronously by default', () => {
        listen('known-event', () => {
          callCount++;
        });
        trigger('known-event');
        expect(callCount).to.equal(1);
      });

      it('listener may return a function to defer and schedule evaluation', async () => {
        listen(
          'known-event',
          () =>
            function() {
              callCount++;
              return delay(10);
            },
          { mode: 'serial' }
        );

        trigger('known-event'); // listener evaluated synchronusly
        trigger('known-event'); // listener deferred (due to the mode)
        expect(callCount).to.equal(1);
      });

      it$('listener may return a Promise-returning function', async seen => {
        listen(
          'known-event',
          () =>
            function() {
              callCount++;
              return Promise.resolve(1.007);
            },
          { mode: 'serial', trigger: { next: 'result' } }
        );

        trigger('known-event'); // listener evaluated synchronusly
        trigger('known-event'); // listener deferred (due to the mode)
        expect(callCount).to.equal(1);

        await after(10);
        expect(seen).to.eql([
          {
            type: 'known-event',
          },
          {
            type: 'known-event',
          },
          {
            payload: 1.007,
            type: 'result',
          },
          {
            payload: 1.007,
            type: 'result',
          },
        ]);
      });

      it$('listener may return an ObservableFactory', async seen => {
        listen(
          'known-event',
          () =>
            function(notify: any) {
              notify.next(1.2);
            },
          { trigger: { next: 'result' } }
        );

        trigger('known-event'); // listener evaluated synchronusly
        trigger('known-event'); // listener deferred (due to the mode)

        expect(seen).to.eql([
          {
            type: 'known-event',
          },
          {
            payload: 1.2,
            type: 'result',
          },
          {
            type: 'known-event',
          },
          {
            payload: 1.2,
            type: 'result',
          },
        ]);
      });

      it$('listener may be a generator', async seen => {
        expect(1).to.eql(1);
        listen(
          'seq',
          function*({ payload: count }) {
            for (let i = 1; i <= count; i++) {
              yield i;
            }
          },
          { trigger: { next: 'seq-value' } }
        );
        trigger('seq', 2);
        expect(seen).to.eql([
          { type: 'seq', payload: 2 },
          { type: 'seq-value', payload: 1 },
          { type: 'seq-value', payload: 2 },
        ]);
      });
    });

    describe('Error Handling', () => {
      it('does not throw for the triggerer', () => {
        listen(true, thrower);
        expect(triggerEvent).not.to.throw();
        expect(callCount).to.equal(1);
      });

      it('is removed if it throws', () => {
        listen(true, thrower);
        expect(triggerEvent).not.to.throw();
        expect(callCount).to.equal(1);
        expect(triggerEvent).not.to.throw();
        expect(callCount).to.equal(1);
      });

      it('is removed if its Observable errors', () => {
        listen(true, throwsError);
        expect(triggerEvent).not.to.throw();
        expect(callCount).to.equal(1);
        expect(triggerEvent).not.to.throw();
        expect(callCount).to.equal(1);
      });

      it('exposes listener exceptions on channel.errors (logs when NODE_ENV is not test)', function() {
        let errors = errorsOn(channel, this);
        listen(true, thrower);
        triggerEvent();

        expect(errors.value.length).to.be.greaterThan(0);
      });

      it('exposes listener errors on channel.errors (logs when NODE_ENV is not test)', function() {
        let errors = errorsOn(channel, this);
        listen(true, throwsError);
        triggerEvent();

        expect(errors.value.length).to.be.greaterThan(0);
      });
    });

    it('cannot modify the event', () => {
      listen(true, mutator);
      const result = triggerEvent();
      expect(result).not.to.have.property('mutantProp');
    });

    it$(
      'can be used to trigger new events asynchronously from Promises',
      async seen => {
        listen('cause', () =>
          delay(1, () => {
            trigger('effect');
          })
        );
        trigger('cause');
        expect(seen).to.eql([{ type: 'cause' }]);
        await query(true);
        expect(seen).to.eql([{ type: 'cause' }, { type: 'effect' }]);
      }
    );

    it$(
      'can be used to trigger new events asynchronously from Observables',
      async seen => {
        listen('cause', () =>
          after(1, () => {
            trigger('effect');
          })
        );
        trigger('cause');
        expect(seen).to.eql([{ type: 'cause' }]);
        await delay(2);
        expect(seen).to.eql([{ type: 'cause' }, { type: 'effect' }]);
      }
    );

    it$('can trigger `next` events via config', async seen => {
      listen('cause', () => after(1, () => '⚡️'), {
        trigger: { next: 'effect' },
      });
      trigger('cause');
      expect(seen).to.eql([{ type: 'cause' }]);
      await delay(2);
      expect(seen).to.eql([
        { type: 'cause' },
        { type: 'effect', payload: '⚡️' },
      ]);
    });

    it$('can trigger `error` events when it dies via config', seen => {
      listen('cause', throwsError, { trigger: { error: 'cause/error' } });
      trigger('cause');
      expect(seen.length).to.equal(2);
      expect(seen[0]).to.eql({ type: 'cause' });
      expect(seen[1].type).to.eq('cause/error');
      expect(seen[1].payload).to.be.instanceOf(Error);

      trigger('cause');
      expect(seen[2]).to.eql({ type: 'cause' });

      // no more errors since the listener was still unsubscribed
      expect(seen).to.have.length(3);
    });

    it$('can trigger `complete` events via config', seen => {
      listen('cause', () => of(2.718), {
        trigger: { next: 'effect', complete: 'cause/complete' },
      });
      trigger('cause');

      expect(seen).to.eql([
        { type: 'cause' },
        { type: 'effect', payload: 2.718 },
        { type: 'cause/complete' },
      ]);
    });

    it$('can trigger events directly via config', seen => {
      listen('cause', () => of({ type: 'constant/e', value: 2.71828 }), {
        trigger: true,
      });
      trigger('cause');

      expect(seen).to.eql([
        { type: 'cause' },
        { type: 'constant/e', value: 2.71828 },
      ]);
    });
  });

  describe('#listen, #listen, #trigger', () => {
    it$('errors in one listener dont affect the others', seen => {
      listen(true, throwsError);
      listen(true, () => {
        callCount++;
      });
      triggerEvent();
      triggerEvent();
      expect(seen).to.have.length(2);

      expect(callCount).to.equal(3);
    });

    it$('runs listeners concurrently', async seen => {
      listen('tick/start', threeTicksTriggered(1, 3, 'tick'));
      listen('tick/start', threeTicksTriggered(1, 3, 'tock'));

      trigger('tick/start');
      await delay(10);
      expect(seen).to.eql([
        { type: 'tick/start' },
        { type: 'tick', payload: 1 },
        { type: 'tock', payload: 1 },
        { type: 'tick', payload: 2 },
        { type: 'tock', payload: 2 },
        { type: 'tick', payload: 3 },
        { type: 'tock', payload: 3 },
      ]);
    });
  });

  describe('Concurrency Modes: #listen, #trigger, #trigger', () => {
    it$('ignore (mute/exhaustMap)', async seen => {
      listen('tick/start', ({ payload }) => threeTicksTriggered(payload, 3)(), {
        mode: ignore,
      });

      // 2 within a short time
      trigger('tick/start', 1);
      trigger('tick/start', 7); // ignored
      await delay(10);
      expect(seen).to.eql([
        { type: 'tick/start', payload: 1 },
        { type: 'tick/start', payload: 7 },
        { type: 'tick', payload: 1 },
        { type: 'tick', payload: 2 },
        { type: 'tick', payload: 3 },
      ]);
    });

    it$('toggle (toggle/toggleMap)', async seen => {
      listen(
        'tick/start',
        ({ payload }) => {
          trigger('tick', 'sync');
          return threeTicksTriggered(payload, 3)();
        },
        {
          mode: toggle,
        }
      );

      // 2 within a short time
      trigger('tick/start', 1);
      trigger('tick/start', 2);
      trigger('tick/start', 3);

      await delay(10);
      expect(seen).to.eql([
        { type: 'tick/start', payload: 1 },
        { type: 'tick', payload: 'sync' },
        // the async part was toggled off
        { type: 'tick/start', payload: 2 },
        { type: 'tick', payload: 'sync' },
        // a new run went to completion
        { type: 'tick/start', payload: 3 },
        { type: 'tick', payload: 'sync' },
        { type: 'tick', payload: 3 },
        { type: 'tick', payload: 4 },
        { type: 'tick', payload: 5 },
      ]);
    });

    it$('replace (cutoff/switchMap', async seen => {
      listen('tick/start', ({ payload }) => threeTicksTriggered(payload, 3)(), {
        mode: replace,
      });

      // 2 within a short time
      const sub = query('tick').subscribe(() => {
        trigger('tick/start', 7);
        sub.unsubscribe();
      });
      trigger('tick/start', 1);

      await delay(20);
      expect(seen).to.eql([
        { type: 'tick/start', payload: 1 },
        { type: 'tick', payload: 1 },
        { type: 'tick/start', payload: 7 },
        { type: 'tick', payload: 7 },
        { type: 'tick', payload: 8 },
        { type: 'tick', payload: 9 },
      ]);
    });

    it$('start (parallel/mergeMap)', async seen => {
      listen('tick/start', ({ payload }) => threeTicksTriggered(payload, 3)(), {
        mode: parallel,
      });

      // 2 within a short time
      trigger('tick/start', 1);
      trigger('tick/start', 7);
      await delay(20);
      expect(seen).to.eql([
        { type: 'tick/start', payload: 1 },
        { type: 'tick/start', payload: 7 },
        { type: 'tick', payload: 1 },
        { type: 'tick', payload: 7 },
        { type: 'tick', payload: 2 },
        { type: 'tick', payload: 8 },
        { type: 'tick', payload: 3 },
        { type: 'tick', payload: 9 },
      ]);
    });

    it$('enqueue (serial/concatMap)', async seen => {
      listen('tick/start', ({ payload }) => threeTicksTriggered(payload, 3)(), {
        mode: serial,
      });

      // 2 within a short time
      trigger('tick/start', 1);
      trigger('tick/start', 7);
      await delay(20);
      expect(seen).to.eql([
        { type: 'tick/start', payload: 1 },
        { type: 'tick/start', payload: 7 },
        { type: 'tick', payload: 1 },
        { type: 'tick', payload: 2 },
        { type: 'tick', payload: 3 },
        { type: 'tick', payload: 7 },
        { type: 'tick', payload: 8 },
        { type: 'tick', payload: 9 },
      ]);
    });
  });

  describe('#listen, #trigger, #listen.unsubscribe', () => {
    it$('cancels in-flight listeners', async seen => {
      const sub = listen('cause', () =>
        after(1, () => {
          trigger('effect');
        })
      );
      trigger('cause');
      expect(seen).to.eql([{ type: 'cause' }]);
      sub.unsubscribe();
      await delay(2);
      expect(seen).to.eql([{ type: 'cause' }]);
    });
  });

  describe('Aliases', () => {
    describe('#on', () => {
      it('is an alias for #listen', () => {
        const result = on(true, () => null);

        expect(result).to.be.instanceOf(Subscription);
      });
    });
  });

  describe('TypeScript Type Inference', () => {
    interface FooPayload {
      fooId: string;
    }

    interface AtLeastFooPayload extends FooPayload {
      [others: string]: any;
    }

    interface FooEvent extends Event {
      type: 'foo';
      bar: string;
    }

    interface FooPayloadEvent extends Event {
      type: 'foo';
      payload: FooPayload;
    }

    describe('#trigger', () => {
      describe('1 argument version', () => {
        it('can strongly type the event', () => {
          trigger<FooEvent>({
            type: 'foo',
            bar: 'baz',
          });
        });

        it('can weakly type the event', () => {
          trigger({
            type: 'foo',
            bam: 'bing',
          });
        });
      });

      describe('2 argument version', () => {
        it('can strongly type the payload', () => {
          trigger<FooPayload>('type', {
            fooId: 'bar',
          });
        });

        it('can weakly type the payload', () => {
          trigger<AtLeastFooPayload>('type', {
            fooId: 'bar',
            catId: 'Mona Lisa',
            dogId: 'Mr. Thompson Wooft',
          });
        });

        it('dont have to type the payload', () => {
          trigger('type', { anyField: true });
        });
      });
    });

    describe('#filter, #trigger', () => {
      it('should type it up', () => {
        filter<FooPayloadEvent>('foo', e => {
          // Typescript helps here
          e.payload.fooId = 'bar';
        });

        // mutates the payload
        const payload = { fooId: 'bazž' };
        let result = trigger<FooPayload>('foo', payload);
        expect(payload.fooId).to.eq('bar');

        // returns mutated payload (no type safety)
        const e: FooPayloadEvent = { type: 'foo', payload: { fooId: 'moo' } };
        result = trigger<FooPayloadEvent>(e);
        expect(result.payload.fooId).to.eq('bar');
      });
    });

    describe('#listen, #trigger', () => {
      it('should type it up', () => {
        const seenFooIds: string[] = [];
        listen<FooPayloadEvent>('foo', e => {
          // Typescript helps here
          seenFooIds.push(e.payload.fooId);
        });

        const payload = { fooId: 'bazž' };
        trigger<FooPayload>('foo', payload);
        expect(seenFooIds).to.eql(['bazž']);
      });
    });

    describe('#query', () => {
      it('should type it up no matter how triggered', () => {
        const fooIdMatches: string[] = [];
        query<FooPayloadEvent>(true).subscribe(n => {
          fooIdMatches.push(n.payload.fooId);
        });
        trigger('foo', { fooId: 'juan' });
        trigger<FooPayload>('foo', { fooId: 'tú' });
        trigger<FooPayloadEvent>({ type: 'foo', payload: { fooId: 'free' } });
        expect(fooIdMatches).to.eql(['juan', 'tú', 'free']);
      });
    });
  });
});

const event = { type: 'anytype', payload: randomId() };
const ignore = ConcurrencyMode.ignore;
const toggle = ConcurrencyMode.toggle;
const replace = ConcurrencyMode.replace;
const parallel = ConcurrencyMode.parallel;
const serial = ConcurrencyMode.serial;

const takesException: Filter<any> = () => {
  throw new Error(`Error: ${randomId()}`);
};

const mutator: Filter<Event> = (e: Event) => {
  // @ts-ignore
  e.mutantProp = ':)';
};

const triggerEvent = () => {
  return trigger(event.type, event.payload);
};

const delay = (ms: number, fn?: any) =>
  new Promise(resolve => {
    setTimeout(() => resolve(fn && fn()), ms);
  });

const threeTicksTriggered = (
  from: number,
  count: number,
  type = 'tick'
) => () => {
  return range(from, count, asyncScheduler).pipe(
    tap(n => {
      trigger(type, n);
    })
  );
};
