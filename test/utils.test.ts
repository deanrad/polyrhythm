import { expect } from 'chai';
import sinon from 'sinon';
import { after } from '../src/utils';
import { concat, timer } from 'rxjs';

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
});
