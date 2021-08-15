import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  Observable,
  Subscription,
  range,
  asyncScheduler,
  throwError,
  of,
} from 'rxjs';
import { tap } from 'rxjs/operators';
import sinon from 'sinon';
import { Channel, MSG_LISTENER_ERROR } from '../src/channel';
import { Event, ConcurrencyMode, Filter } from '../src/types';
import { randomId, after } from '../src/utils';
import chai from 'chai'
import sinonChai from 'sinon-chai'
chai.should();
chai.use(sinonChai);

const channel = new Channel();
const trigger = channel.trigger.bind(channel);
const query = channel.query.bind(channel);
const filter = channel.filter.bind(channel);
const listen = channel.listen.bind(channel);
const on = channel.on.bind(channel);
const spy = channel.spy.bind(channel);
const reset = channel.reset.bind(channel);
const observe = channel.observe.bind(channel);

function captureEvents<T>(testFn: (arg: T[]) => void | Promise<any>) {
  return function () {
    const seen = new Array<T>();
    // @ts-ignore
    const sub = channel.query(true).subscribe(event => seen.push(event));
    const result: any = testFn(seen);
    if (result && result.then) {
      return result.finally(() => sub.unsubscribe());
    }
    sub.unsubscribe();
    return result;
  };
}

function it$(name: string, fn: (arg: Event[]) => void | Promise<any>) {
  it(name, captureEvents(fn));
}

require('clear')();

describe('Channel Behavior', () => {
  let callCount = 0;
  const thrower: Filter<Event> = (e: Event) => {
    callCount++;
    syncThrow(e);
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
  afterEach(function () {
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
  });

  describe('#query', () => {
    it('returns an Observable of events', () => {
      const result = query(true);

      expect(result).to.be.instanceOf(Observable);
    });

    describe('.toPromise()', () => {
      it('can be awaited; reply in same callstack', async () => {
        listen('data/query', () => {
          trigger('data/result', 2.5);
        });

        // its important the query for the result be subscribed via toPromise()
        // before the trigger occurs, to acomodate the case of the same callstack
        // Wouldn't work for a sync-triggering listener:
        // const { payload } = trigger('data/query') && (await query('data/result').toPromise());
        const resultEvent = query('data/result').toPromise();
        trigger('data/query');
        const { payload } = await resultEvent;
        expect(payload).to.equal(2.5);
      });

      it('can be awaited; reply in later callstack', async () => {
        listen('auth/login', () => after(1, () => trigger('auth/token', 2.7)));

        const tokenEvent = query('auth/token').toPromise();
        const { payload } = trigger('auth/login') && (await tokenEvent);
        expect(payload).to.equal(2.7);
      });
    });

    describe('inside of a #listen', () => {
      it('misses its own event, of course', async function () {
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
    describe('Arguments', () => {
      function simpleTest() {
        filter('foo', () => {
          callCount++;
        });
        trigger('foo');
        expect(callCount).to.equal(1);
      }

      describe('eventMatcher', () => {
        it('defines events the filter will run upon', simpleTest);
      });
      describe('filter function', () => {
        it('defines the function to be run on matching events', simpleTest);
      });
    });

    it('returns a subscription', () => {
      const result = filter(true, () => null);
      expect(result).to.be.instanceOf(Subscription);
      expect(result).to.haveOwnProperty('closed', false);
    });
    it('is cancelable', () => {
      const subs = filter(true, () => {
        callCount++;
      });
      subs.unsubscribe();
      trigger('foo');
      expect(callCount).to.equal(0);
    });
  });

  describe('#listen', () => {
    function simpleTest() {
      listen('foo', () => {
        callCount++;
      });
      trigger('foo');
      trigger('not-foo');
      expect(callCount).to.equal(1);
    }
    describe('Arguments', () => {
      describe('eventMatcher', () => {
        it('defines the events the listener will run upon', simpleTest);
      });

      describe('listener function', () => {
        it('defines the function to be run on matching events', simpleTest);
        it('recieves a frozen event', () => {
          listen('foo', e => {
            expect(Object.isFrozen(e)).to.equal(true);
          });
          trigger('foo');
        });

        it('listener may return a function to defer and schedule evaluation', async () => {
          listen(
            'known-event',
            () =>
              function () {
                callCount++;
                return delay(10);
              },
            { mode: 'serial' }
          );

          trigger('known-event'); // listener evaluated synchronusly
          trigger('known-event'); // listener deferred (due to the mode)
          expect(callCount).to.equal(1);
        });
      });

      describe('config', () => {
        it('See #listen / #trigger specs');
      });
    });

    it('returns a subscription', () => {
      const result = listen(true, () => { });

      expect(result).to.be.instanceOf(Subscription);
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
      filter(true, syncThrow);
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

  describe('#trigger, #query', () => {
    it('does not find events triggered before the query', function () {
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

      it$('listener may return a Promise-returning function', async seen => {
        listen(
          'known-event',
          () =>
            function () {
              callCount++;
              return Promise.resolve(1.007);
            },
          { mode: 'serial', trigger: { next: 'result' } }
        );

        trigger('known-event'); // listener evaluated synchronusly
        trigger('known-event'); // listener deferred (due to the mode)
        expect(callCount).to.equal(1);

        await after(10);
        expect(seen.map(e => e.type)).to.eql([
          'known-event',
          'known-event',
          'result',
          'result',
        ]);
      });

      it(
        'can trigger `next` events via config',
        captureEvents(async seen => {
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
        })
      );

      it(
        'Does not exapand a string when returned bare from a handler',
        captureEvents(async seen => {
          listen('cause', () => 'abc', {
            trigger: { next: 'effect' },
          });
          trigger('cause');
          expect(seen).to.eql([
            { type: 'cause' },
            { type: 'effect', payload: 'abc' },
          ]);
        })
      );

      it(
        'Expands an array/iterable when returned bare from a handler',
        captureEvents(async seen => {
          listen('cause', () => ['a', 'b'], {
            trigger: { next: 'effect' },
          });
          trigger('cause');
          expect(seen).to.eql([
            { type: 'cause' },
            { type: 'effect', payload: 'a' },
            { type: 'effect', payload: 'b' },
          ]);
        })
      );

      it(
        'Expands/runs a generator',
        captureEvents(async seen => {
          expect(1).to.eql(1);
          listen(
            'seq',
            function* ({ payload: count }) {
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
        })
      );
    });
    describe('Config options', () => {
      it(
        'can trigger `next` events via config - and errors kill',
        captureEvents(async seen => {
          // when the 'cause' listener triggers next, it'll throw
          filter('call-err', syncThrow);

          // This listener will be brought down by the exception
          const subs = listen('cause', () => after(1, () => '⚡️'), {
            trigger: { next: 'call-err' },
          });

          trigger('cause');
          await delay(2);

          // Error killed it
          expect(subs).to.have.property('closed', true);

          expect(seen).to.eql([{ type: 'cause' }]);
          trigger('cause');
          await delay(2);
          // No effect, no error
          expect(seen).to.eql([{ type: 'cause' }, { type: 'cause' }]);
        })
      );

      it(
        'can terminate a listener via takeUntil',
        captureEvents(async seen => {
          listen(
            'start',
            () =>
              new Observable(() => {
                const subs = after(1, () => {
                  trigger('⚡️');
                }).subscribe();
                return () => {
                  trigger('unsub');
                  subs.unsubscribe();
                };
              }),
            { takeUntil: 'end' }
          );

          trigger('start');
          // @ts-ignore
          expect(seen.map(e => e.type)).to.eql(['start']);
          trigger('end');
          await after(1);
          // @ts-ignore
          expect(seen.map(e => e.type)).to.eql(['start', 'end', 'unsub']);
        })
      );

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

      it$('can rescue `error` events via config', seen => {
        listen('cause', throwsError, { trigger: { error: 'cause/error' } });
        trigger('cause');
        expect(seen.length).to.equal(2);
        expect(seen[0]).to.eql({ type: 'cause' });
        expect(seen[1].type).to.eq('cause/error');
        expect(seen[1].payload).to.be.instanceOf(Error);

        trigger('cause');
        expect(seen[2]).to.eql({ type: 'cause' });

        // rescued, so both causes and effects
        expect(seen).to.have.length(4);
      });

      it(
        'can trigger `start` events via config - parallel',
        captureEvents(async seen => {
          listen('cause', () => after(1, () => '⚡️'), {
            mode: 'parallel',
            trigger: { start: 'started', next: 'effect' },
          });
          trigger('cause', 'a');
          trigger('cause', 'b');

          await delay(5);
          expect(seen).to.eql([
            { type: 'cause', payload: 'a' },
            { type: 'started', payload: 'a' },
            { type: 'cause', payload: 'b' },
            { type: 'started', payload: 'b' },
            { type: 'effect', payload: '⚡️' },
            { type: 'effect', payload: '⚡️' },
          ]);
        })
      );

      it(
        'can trigger `start` events via config - serial',
        captureEvents(async seen => {
          listen('cause', () => after(1, () => '⚡️'), {
            mode: 'serial',
            trigger: { start: 'started', next: 'effect' },
          });

          trigger('cause', 'a');
          trigger('cause', 'b');

          await delay(5);
          expect(seen).to.eql([
            { type: 'cause', payload: 'a' },
            { type: 'started', payload: 'a' },
            { type: 'cause', payload: 'b' },
            { type: 'effect', payload: '⚡️' },
            { type: 'started', payload: 'b' },
            { type: 'effect', payload: '⚡️' },
          ]);
        })
      );

      // RxJS 7.3.0 will enable this
      it.skip(
        'can trigger `cancel` events via config',
        captureEvents(async seen => {
          const sub = listen('cause', () => after(1, () => '⚡️'), {
            trigger: { cancel: 'canceled' },
          });

          trigger('cause', 'a');
          sub.unsubscribe();

          await delay(5);
          expect(seen).to.eql([
            { type: 'cause', payload: 'a' },
            { type: 'canceled' }

            // but can it refer to the event that was canceled?
            // { type: 'canceled', payload: { type: 'cause', payload: 'a' } }]);
          ]);
        })
      );

      it(
        'can trigger entire Observable events with trigger:true',
        captureEvents(async seen => {
          listen(
            'cause',
            () => after(1, () => ({ type: 'effect', payload: '⚡️' })),
            {
              trigger: true,
            }
          );

          trigger('cause', 'a');

          await delay(5);
          expect(seen).to.eql([
            { type: 'cause', payload: 'a' },
            { type: 'effect', payload: '⚡️' },
          ]);
        })
      );
    });

    describe('Error Handling', () => {
      describe('Sync Errors', () => {
        it('does not throw for the triggerer', () => {
          listen(true, thrower);
          expect(triggerEvent).not.to.throw();
        });

        it('terminates the listener subscription', () => {
          const subs = listen(true, thrower);
          triggerEvent();
          expect(callCount).to.equal(1);
          expect(subs).to.have.property('closed', true);
          triggerEvent();
          expect(callCount).to.equal(1);
        });

        it('spits out an error message', () => {
          const seen: Array<any>= []
          channel.errors.subscribe(e => seen.push(e) );

          listen(true, thrower);
          triggerEvent();

          expect(seen).to.have.length(2)
          expect(seen[1]).to.equal(MSG_LISTENER_ERROR)
        })
      });

      describe('Observable Errors', () => {
        it('does not throw for the triggerer', () => {
          listen(true, throwsError);
          expect(triggerEvent).not.to.throw();
        });

        it('terminates the listener subscription', () => {
          const subs = listen(true, throwsError);
          triggerEvent();
          expect(callCount).to.equal(1);
          expect(subs).to.have.property('closed', true);
          triggerEvent();
          expect(callCount).to.equal(1);
        });

        it('fails on downstream filter errors', () => {
          filter('throws-error', syncThrow);
          let cc = 0;
          listen('top-level', () => {
            cc++;
            trigger('throws-error');
          });
          trigger('top-level');
          expect(cc).to.equal(1);
          trigger('top-level');
          expect(cc).to.equal(1);
        });

        it('survives downstream listener errors (spawned not forked)', () => {
          const errSub = listen('throws-error', throwsError);
          let cc = 0;
          const spawnerSub = listen('top-level', () => {
            cc++;
            trigger('throws-error');
          });
          trigger('top-level');
          expect(cc).to.equal(1);
          expect(errSub).to.have.property('closed', true);
          expect(spawnerSub).to.have.property('closed', false);

          trigger('top-level');
          expect(cc).to.equal(2);
        });
      });
    });
  });

  describe('#observe, #trigger', () => {
    describe('Happy Path', () => {
      it('invokes next with the returned payload', () => {
        const nextSpy = sinon.spy();
        observe('foo', () => after(0, 'bar'), {
          next: nextSpy,
        })
        trigger('foo')
        expect(nextSpy).to.have.been.calledWith('bar');
      })
      it('invokes complete for each invocation', () => {
        const completeSpy = sinon.spy();
        observe('foo', () => after(0, 'bar'), {
          complete: completeSpy
        })
        trigger('foo')
        trigger('foo')
        expect(completeSpy).to.have.been.calledTwice;
      })
    })

  })
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
        // the async part was toggled off
        { type: 'tick/start', payload: 2 },
        // a new run went to completion
        { type: 'tick/start', payload: 3 },
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

  describe('#reset', () => {
    let bac = 0;
    beforeEach(() => {
      bac = 0;
    });
    it('wont fire filters after reset', () => {
      filter('beer', () => {
        bac += 0.1;
      });
      reset();
      trigger('beer');
      expect(bac).to.equal(0);
    });

    it('wont fire listeners after reset', () => {
      listen('beer', () => {
        bac += 0.1;
      });
      reset();
      trigger('beer');
      expect(bac).to.equal(0);
    });

    it('terminates existing listeners', async () => {
      const subs = listen('beer', () => {
        return after(1, () => {
          bac += 0.1;
        });
      });
      trigger('beer');
      reset();
      expect(subs).to.have.property('closed', true);

      await after(2);
      expect(bac).to.equal(0);
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
      it('can mutate the payload', () => {
        filter<FooPayloadEvent>('foo', e => {
          // Typescript helps here
          e.payload.fooId = 'bar';
        });

        // mutates the payload
        const payload = { fooId: 'bazž' };
        let result = trigger('foo', payload);
        expect(payload.fooId).to.eq('bar');

        // returns mutated payload (no type safety)
        const e: FooPayloadEvent = { type: 'foo', payload: { fooId: 'moo' } };
        result = trigger<FooPayloadEvent>(e);
        expect(result.payload.fooId).to.eq('bar');
      });
      it('can return a new payload to sub out for listeners', () => {
        const seenFooIds: Array<string> = [];
        filter<FooPayloadEvent>('foo', e => {
          return { type: e.type, payload: { fooId: 'bar' } };
        });
        listen('foo', e => {
          seenFooIds.push(e.payload.fooId);
        });

        const payload = { fooId: 'bazž' };
        trigger('foo', payload);

        // the filter replaces the event
        expect(seenFooIds).to.include('bar');
      });

      it('can return null to hide from listeners', () => {
        const seenFooIds: Array<string> = [];
        filter<FooPayloadEvent>('foo', e => {
          return null;
        });
        listen('foo', e => {
          seenFooIds.push(e.payload.fooId);
        });

        const payload = { fooId: 'bazž' };
        trigger('foo', payload);
        expect(seenFooIds.length).to.equal(0);
      });
    });

    describe('#listen, #trigger', () => {
      it('should type it up', () => {
        const seenFooIds: string[] = [];
        listen<FooPayloadEvent, void>('foo', e => {
          // Typescript helps here
          seenFooIds.push(e.payload.fooId);
        });

        const payload = { fooId: 'bazž' };
        trigger<FooPayload>('foo', payload);
        expect(seenFooIds).to.eql(['bazž']);
      });
    });
  });

  describe('Aliases', () => {
    describe('#on', () => {
      it('is an alias for #listen', () => {
        const result = on(true, () => { });
        expect(result).to.be.instanceOf(Subscription);
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

const syncThrow: Filter<any> = () => {
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
