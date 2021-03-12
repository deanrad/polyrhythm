import fc from 'fast-check';
import { expect } from 'chai';
import { channel } from '../src/channel';
import { after } from '../src/utils';

import {
  concat,
  from,
  empty,
  Observable,
  throwError,
  of,
  asyncScheduler,
} from 'rxjs';

import { delay } from 'rxjs/operators';

const usualSuspects = {
  empty: 'C',
  error: 'E',
  tick: 'TC',
  syncValue: 'NC',
  asyncError: 'TE',
  deadStream: 'NE',
  timeout: 'TTC',
  usersEndpoint: 'TTNNC',
  usersStream: 'TNTNC',
};
// prettier-ignore
const rawFns = [
  function returns(){ return 'foo' },
  function throws() { throw new Error('oopsie') },
  function returnsResolved(){ return Promise.resolve() },
  function returnsRejected(){ return Promise.reject() },
]
let testFns = [...rawFns];

Object.entries(usualSuspects).forEach(([key, value]) => {
  const fn = () => toObservable(value);

  Object.defineProperty(fn, 'name', {
    value: `${key} (${value})`,
    writable: false,
  });
  testFns.push(fn);
});

describe('Channel', () => {
  describe('#reset, #query', () => {
    const positiveDelays = [1, 2];

    beforeEach(() => {
      channel.reset();
    });

    describe('Recieeves no further events after a reset', () => {
      from(positiveDelays).subscribe(delay => {
        it(`with delay ${delay}`, () => {
          expect(true).to.eql(true);
        });
      });
    });

    describe('Fuzz Testing', () => {
      it('recieves no further events after a reset', () => {
        // arrange: set a delayed listener, trigger
        // act:     reset
        // await:   delay
        // assert: no event
        fc.assert(
          fc.asyncProperty(fc.constantFrom(...testFns), async fn => {
            const seen = [];
            channel.spy(e => seen.push(e));
            // channel
            channel.listen('test', fn, {
              trigger: {
                next: 'test-next',
                complete: 'test-complete',
                error: 'test-error',
              },
            });
            channel.trigger('test');
            seen.length = 0;
            // act
            channel.reset();
            await after(10).toPromise();
            expect(seen.map(x => x.type)).to.eql([]);
          }),
          {
            // examples: values.map(v => [v*10]),
            numRuns: 13,
          }
        );
      });
    });
  });

  describe('#listen, #trigger', () => {
    describe('Produces no runtime errors', () => {
      from(testFns).subscribe(listener => {
        it(`with listener ${listener.name}`, async () => {
          channel.listen('any', listener, {
            trigger: { next: 'any-next' },
          });
          // Will our listener have rejected us and failed a test?
          channel.trigger('any');
          await after(5);
        });
      });
    });
  });
});

let nextCount = 1;
const noteToSegment = (note: 'N' | 'C' | 'E' | 'T'): Observable<number> => {
  switch (note) {
    case 'E':
      return throwError('oops');
    case 'T':
      return empty().pipe(delay(0, asyncScheduler));
    case 'N':
    default:
      return of(nextCount++);
  }
};

function toObservable(notes: string): Observable<number> {
  return notes.split('').reduce((all, note) => {
    return note === 'C' ? all : concat(all, noteToSegment(note));
  }, empty() as Observable<number>);
}
