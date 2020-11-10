## Releases

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [1.1.3 await query(), and succint tests](#113-await-query-and-succint-tests)
- [1.1.2 Support generators as listeners](#112-support-generators-as-listeners)
- [1.1.1 Add optional TypeScript typings](#111-add-optional-typescript-typings)
- [1.1.0 Remove React dependencies](#110-remove-react-dependencies)
- [1.0.12 Trigger whole event objects](#1012-trigger-whole-event-objects)
- [1.0.11 `query.toPromise()` returns the next matching event](#1011-querytopromise-returns-the-next-matching-event)
- [1.0.8 `microq` and `macroq` functions](#108-microq-and-macroq-functions)
- [1.0.7 TypeScript typings corrected for `after`](#107-typescript-typings-corrected-for-after)
- [1.0.6 Handy RxJS exports](#106-handy-rxjs-exports)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

#### 1.1.3 await query(), and succint tests

Similar to `after`, there is a `then` method exposed on the return value from `query()`, so it is await-able without explicitly calling `toPromise` on it. Also, found a really nice testing pattern that will work as well in a `this`-less test framework like Jest, as it does in mocha, and also has fewer moving parts overall.

#### 1.1.2 Support generators as listeners

For Redux Saga and generator fans, a listener can be a generator function— Observable-wrapping of generators is easily done.

#### 1.1.1 Add optional TypeScript typings

The primary functions you use to `trigger`, `filter`, `listen`, and `query` the event bus, as well as the `after` utility, all at least somewhat support adding Typescript for addtional editor awareness.

#### 1.1.0 Remove React dependencies

The convenience hooks have been moved to the [polyrhythm-react](https://github.com/deanius/polyrhythm-react), so as not to import React in Node environments, or express a framework preference.

#### 1.0.12 Trigger whole event objects

Inspired by JQuery, the polyrhythm API `trigger` took the name of the event and the payload separately.

```js
const result = trigger('event/type', { id: 'foo' });
```

A Flux Standard Action was created for you with `type`, and `payload` fields. This meant that in Listeners, the event object you'd get would have `id` nested under the `payload` field of the event.

```js
listen('event/type', ({ payload: { id } }) => fetch(/* use the id */));
```

But what if you have Action Creator functions returning objects, must you split them apart? And what if you dont' want to nest under `payload` for compatibility with some other parts of your system? Now, you can just trigger objects:

```js
const result = trigger({ type: 'event/type', id: 'foo' });
listen('event/type', ({ id }) => fetch(/* use the id */));
```

Remember to keep the `type` field populated with a string, all of polyrhtyhm keys off of that, but shape the rest of the event how you like it!

---

#### 1.0.11 `query.toPromise()` returns the next matching event

Commit: ([cb5a859](https://github.com/deanius/polyrhythm/commit/cb5a859))

A common thing to do is to trigger an event and await a promise for a response, for example with events `api/search` and `api/results`.

The way to do this before was to set up a promise for the response event type, then trigger the event that does the query. With proper cleanup, it looked like this:

```js
const result = new Promise(resolve => {
  const sub = query('api/results').subscribe(event => {
      sub.unsubscribe()
      resolve(event)
  })
}
trigger('api/search', { q: 'query' })
result.then(/* do something with the response */)
```

To simplify this pattern, now you can do:

```js
const result = query('api/results').toPromise();

trigger('api/search', { q: 'query' });
result.then(/* do something with the response */);
```

To do this polyrhythm redefines `toPromise()` on the
Observable returned by `query` to be a Promise that resolves as of the first event. As noted by Georgi Parlakov [here](https://levelup.gitconnected.com/rxjs-operator-topromise-waits-for-your-observable-to-complete-e7a002f5dccb), `toPromise()` waits for your Observable to complete, so will never resolve if over a stream that doesn't complete, and polyrhythms event bus and queries over it do not complete by design!

A couple of tips:

- The call to `toPromise()` _must_ be done prior to calling `trigger`, or your result event may be missed.
- Attaching the `then` handler to the Promise can be done before or after calling `trigger` - Promises are flexible like that.

Keep in mind that using a listener is still supported, and is often preferred, since it allows you to limit the concern of some components to being `trigger`-ers of events, and allowing other components to respond by updating spinners, and displaying results.

```js
listen('api/results', ({ type, payload }) => {
  /* do something with the response */
});

trigger('api/search', { q: 'query' });
```

If there may be many different sources of `api/results` from `api/query` events, you can include an ID in the event. This code shows how to append a query identifier in each event type:

```js
const queryId = 123;
const result = query(`api/results/${queryId}`).toPromise();

trigger(`api/search/${queryId}`, { q: 'query' });
result.then(/* do something with the response */);
```

On a humorous note, it was funny because I'd published the package without building it twice, making builds 1.0.9 and 1.0.10 useless. At least I discovered the npm `prepublishOnly` hook to save me from that in the future.

---

#### 1.0.8 `microq` and `macroq` functions

Commit: ([bc583de](https://github.com/deanius/polyrhythm/commit/bc583de))

Here's a fun quiz: In what order are the functions `fn1`, `fn2`, `fn3`, `fn4` called?

```js
/* A */ Promise.resolve(1).then(() => fn1());

/* B */ await 2;
fn2();

/* C */ setTimeout(() => fn3(), 0);

/* D */ fn4();
```

Obviously the synchronous function `fn4` is called before async ones - but in **B**, is `fn3` delayed or sync, when awaiting a constant? And which completes first, `Promise.resolve(fn1)`, or `setTimeout(fn3, 0)`? I found this stuff hard to remember, different in Node vs Browsers, and the complicated explanations left me wanting simply more readable API calls. So polyrhythm now exports `microq` and `macroq` functions.

In summary, you can use `macroq` to replace `setTimeout(fn, 0)` code with `macroq(fn)`. This provides equivalent behavior which does not block the event loop. And you can use `microq(fn)` for async behavior that is equivalent to resolved-Promise deferring, for cases like layout that must complete before the next turn of the event loop.

Quiz Explanation: **B** is essentially converted to **A**— a deferred call— despite the value `2` being synchronously available, because that's what `await` does. And promise resolutions are processed before `setTimeout(0)` calls. This is because JS has basically two places asynchronous code can go, the microtask queue and the macrotask queue. They are detailed [on MDN here](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), but to simplify, the quiz example code basically boils down to this.

```js
/* A */ microq(fn1);

/* B */ microq(fn2);

/* C */ macroq(fn3);

/* D */ fn4();
```

And thus the answer is `fn4`, `fn1`, `fn2`, and `fn3`, or **D**,**A**,**B**,**C**.

---

#### 1.0.7 TypeScript typings corrected for `after`

Commit: ([defeeeb](https://github.com/deanius/polyrhythm/commit/defeeeb))

Aside from having an awesome SHA, 1.0.7 is a TypeScript-only enhancement to the `after` function. Remember `after` is the setTimeout you always wanted - a lazy, composable, subscribable, awaitable object:

```js
async function ignitionSequence() {
  await after(1000, () => console.log('3'));
  await after(1000, () => console.log('2'));
  await after(1000, () => console.log('1'));
  await after(1000, () => console.log('blastoff!'));
}
ignitionSequence();
```

So basically, `after` is a deferred, Observable value or a function call. I won't call it a Monadic lift, because I'm not sure, but I think that's what it is :)

Anyway, now TypeScript/VSCode won't yell at you if you omit a 2nd argument.

```js
async function ignitionSequence() {
  await after(1000, () => console.log('3'));
  await after(1000, () => console.log('2'));
  await after(1000, () => console.log('1'));
  await after(1000); // dramatic pause!
  await after(1000, () => console.log('blastoff!'));
}
ignitionSequence();
```

And just to refresh your memory for the DRY-er, more readable way to do such a sequence:

```js
const ignitionSequence = () =>
  concat(
    after(1000, '3'),
    after(1000, '2'),
    after(1000, '1'),
    after(1000, 'blastoff!')
  );

ignitionSequence().subscribe(count => console.log(count));
```

You can get imports `after` and `concat` directly from polyrhythm, as of

`after` is so handy, there needs to be a full blog post devoted to it.

---

#### 1.0.6 Handy RxJS exports

Commit: ([ee38e6a](https://github.com/deanius/polyrhythm/commit/ee38e6a))

If you use polyrhythm, you already have certain components of RxJS in your app. If you need to use only those components, you shouldn't need to have an explicit dependency on RxJS as well. For the fundamental operators `map`, `tap`, and `scan` that polyrhythm relies upon, you can import these directly. Same with the `concat` function of RxJS.

```diff
- import { tap } from 'rxjs/operators'
- import { concat } from 'rxjs'
+ import { tap, concat } from 'polyrhythm'
```

Unfortunately it looks like I introduced a conflict where `filter` is exported both as an RxJS operator and as the `channel.filter` function - it might be a source of error for some situations, but I'll address it in a patch later.
