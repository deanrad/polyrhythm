import { expect } from 'chai';
import { describe, it } from 'mocha';
// import { trigger } from '../src/index';
import { trigger } from '../src/channel';

require('clear')();
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

describe('#query', () => {
  it('returns an Observable of events');
  describe('#query > #trigger', () => {
    it('finds events triggered later');
  });
  describe('#trigger > #query', () => {
    it('does not find events triggered before');
  });
});
