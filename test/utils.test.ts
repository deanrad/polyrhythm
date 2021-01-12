import { expect } from 'chai';
import sinon from 'sinon';
import { after, microq, macroq, microflush, macroflush } from '../src/utils';
import { concat, timer } from 'rxjs';
import { fakeSchedulers } from 'rxjs-marbles/mocha';

describe('Utilities', () => {
  describe('after', () => {
    let counter = 0;
    // a function incrementing c
    const incrementCounter = () => {
      return ++counter;
    };

    describe('First argument', () => {
      describe('If zero (0)', () => {
        it('executes synchronously when subscribed', async () => {
          const effects = new Array<number>();

          // sync
          after(0, () => effects.push(1)).subscribe();
          // not subscribed
          const effect2 = after(0, () => effects.push(2));

          expect(effects).to.eql([1]);

          effect2.subscribe();
          expect(effects).to.eql([1, 2]);
        });
      });
      describe('Greater than 0', () => {
        it('defers the function till then', async () => {
          const effects = new Array<number>();
          after(5, () => {
            effects.push(1);
          }).subscribe();

          expect(effects).to.eql([]);
          await after(10, () => {
            expect(effects).to.eql([1]);
          });
        });
      });
      describe('Positive infinity', () => {
        it('is Observable.never', () => {
          const finished = sinon.spy();
          // Never do this obviously!
          // await after(Infinity, () => {})
          after(Infinity, () => {}).subscribe({
            complete: finished,
          });
          expect(finished.args.length).to.equal(0);
        });
      });
    });
    describe('Second argument', () => {
      describe('when a function', () => {
        it('Schedules its execution later', async () => {
          let counter = 0;
          await after(1, () => counter++).toPromise();
          expect(counter).to.eql(1);
        });
        it('Returns its return value', async () => {
          let result = await after(1, () => 2.71).toPromise();
          expect(result).to.eql(2.71);
        });
      });
      describe('when a value', () => {
        it('Becomes the value of the Observable', async () => {
          const result = await after(1, 2.718).toPromise();
          expect(result).to.eql(2.718);
        });
      });
      describe('when not provided', () => {
        it('undefined becomes the value of the Observable', async () => {
          const result = await after(1).toPromise();
          expect(result).to.eql(undefined);
        });
      });
    });
    describe('Return Value', () => {
      it('Is unstarted/lazy/not running', async () => {
        after(1, incrementCounter); // no .subscribe() or .toPromise()

        // Wait long enough that we'd see a change if it was eager (but it's lazy)
        await timer(10).toPromise();
        expect(counter).not.to.be.greaterThan(0);
      });
      it('Can be obtained via subscribe', done => {
        after(10, 1.1).subscribe(n => {
          expect(n).to.eql(1.1);
          done();
        });
      });
      it('Can be awaited directly', async () => {
        const result = await after(1, () => 2.718);
        expect(result).to.eql(2.718);
      });
    });
    describe('Cancelability', () => {
      it('Can be canceled', async () => {
        const effects = new Array<number>();

        const twoEvents = [1, 2].map(i => after(5, () => effects.push(i)));

        const sub = concat(...twoEvents).subscribe();

        await after(5, () => {
          expect(effects).to.eql([1]);
          sub.unsubscribe();
        });
        await after(15, () => {
          expect(effects).to.eql([1]);
        });
      });
    });

    describe('Typescript Inference', () => {
      interface FooPayload {
        fooId: string;
      }

      it('lets you type the deferred value', () => {
        const a = after<FooPayload>(0, { fooId: 'abc' });
        a.subscribe(n => {
          // got typescript support!
          // n.fooId;
          expect(n).to.eql({ fooId: 'abc' });
        });
      });

      it('lets you type the deferred value producing function ', () => {
        const a = after<FooPayload>(0, () => ({ fooId: 'abc' }));
        a.subscribe(n => {
          // got typescript support!
          // n.fooId;
          expect(n).to.eql({ fooId: 'abc' });
        });
      });

      it('lets you see types through then', () => {
        const a = after<FooPayload>(0, () => ({ fooId: 'abc' }));
        a.then(n => {
          // got typescript support!
          // n.fooId;
          expect(n).to.eql({ fooId: 'abc' });
        });
      });
    });
  });

  describe('microq (microqueue)', () => {
    it('executes functions on the microtask queue', async () => {
      const seen: Array<number> = [];
      microq(() => seen.push(1));
      microq(() => seen.push(2));

      setTimeout(() => seen.push(3), 0);
      await Promise.resolve();
      expect(seen).to.eql([1, 2]);
    });

    it('promises the function return value', async () => {
      expect(await microq(() => 2)).to.eq(2);
    });
  });

  describe('macroq (macroqueue)', () => {
    it('executes functions on the macrotask queue', async () => {
      const seen: Array<number> = [];
      microq(() => seen.push(1));
      setTimeout(() => seen.push(2), 0);
      const result = macroq(() => seen.push(3));

      await result;
      expect(seen).to.eql([1, 2, 3]);
    });

    it('promises the function return value', async () => {
      expect(await microq(() => 2)).to.eq(2);
    });
  });

  describe('microflush/macroflush (a flush of the respective queue)', () => {
    it('returns a Promise for a timestamp some time in the future', async () => {
      const now = new Date().getTime();
      const [microTime, macroTime] = await Promise.all([
        microflush(),
        macroflush(),
      ]);

      expect(microTime).to.be.at.least(now);
      expect(macroTime).to.be.at.least(microTime);
    });

    it('resolves a microflush first', () => {
      return Promise.all([microflush(), macroflush()]).then(
        ([microTime, macroTime]) => {
          expect(macroTime).to.be.at.least(microTime);
        }
      );
    });

    describe('microflush', () => {
      it('ensures existing microtasks are flushed', () => {
        let counter = 0;
        microq(() => (counter += 1));

        expect(counter).to.equal(0);

        return microflush().then(() => {
          expect(counter).to.equal(1);
        });
      });
    });

    describe('macroflush', () => {
      it('ensures existing macrotasks are flushed', () => {
        let counter = 0;
        microq(() => (counter += 0.1));
        macroq(() => (counter += 1));

        expect(counter).to.equal(0);

        return microflush()
          .then(() => {
            expect(counter).to.equal(0.1);
          })
          .then(() => {
            return macroflush();
          })
          .then(() => {
            expect(counter).to.equal(1.1);
          });
      });
    });
  });

  describe('Virtual time testing (mocha)', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });
    afterEach(() => {
      clock?.restore();
    });
    it(
      'is faster than real elapsed time',
      fakeSchedulers(() => {
        let seen = 0,
          WAIT = 100;
        after(WAIT, 3.14).subscribe(v => {
          seen = v;
        });
        clock.tick(WAIT);
        expect(seen).to.eq(3.14);
      })
    );
  });

  describe('combineWithConcurrency', () => {
    describe(
      'Lets you combine Observables without operators',
      fakeSchedulers(() => {
        it('in parallel');
        it('in serial');
        it('replacing any old with the new');
        it('ignoring any new, if an old is present');
        it('toggling any old off');
      })
    );
  });
});
