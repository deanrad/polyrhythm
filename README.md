[![npm version](https://badge.fury.io/js/polyrhythm.svg)](https://badge.fury.io/js/polyrhythm)[![<6 Kb](https://img.shields.io/badge/gzip%20size-%3C6%20kB-brightgreen.svg)](https://www.npmjs.com/package/polyrhythm)
[![Travis](https://img.shields.io/travis/deanius/polyrhythm.svg)](https://travis-ci.org/deanius/polyrhythm)
[![Maintainability](https://api.codeclimate.com/v1/badges/a99a88d28ad37a79dbf6/maintainability)](https://codeclimate.com/github/deanius/polyrhythm/maintainability)
[![TypeScript](https://camo.githubusercontent.com/832d01092b0e822178475741271b049a2e27df13/68747470733a2f2f62616467656e2e6e65742f62616467652f2d2f547970655363726970742f626c75653f69636f6e3d74797065736372697074266c6162656c)](https://github.com/ellerbrock/typescript-badges/)<a href="#badge"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"></a>[![twitter link](https://img.shields.io/badge/twitter-@deaniusdev-55acee.svg)](https://twitter.com/deaniusdev)

# polyrhythm 🎵🎶

Polyrhythm is a Domain Specific Language for building UIs with JavaScript.

Inspired by:

- 💙JQuery. No, really. Particularly [#on](https://api.jquery.com/on/) and [#trigger](https://api.jquery.com/trigger/).
- 💜RxJS. Nearly as old as JQuery.
- 💜Redux-Observable. Async consequences of events.

## Installation

```
npm install polyrhythm
```

## Examples - What Can You Build?

- The Ping Pong Example (as Soccer): [CodeSandbox](https://codesandbox.io/s/polyrhythm-ping-pong-r6zk5)
- The [Redux Toolkit]() Examples: ([Simple](https://codesandbox.io/s/poly-redux-toolkit-14g45))
- A Chat UI With Typing Indicator: [CodeSandbox](https://codesandbox.io/s/poly-chat-imw2z)
- [Seven GUIs](https://eugenkiss.github.io/7guis/tasks) Solutions [1-Counter](https://codesandbox.io/s/7guis-1-counter-17pxb) | [2-Temperature](https://codesandbox.io/s/7guis-2-temperature-bnjbf) | [3-Flight](https://codesandbox.io/s/7guis-3-flight-c6wre) | [4-CRUD](https://codesandbox.io/s/7guis-4-crud-7wjut) | [5-Timer](https://codesandbox.io/s/7guis-5-timer-xgop9)
- See [All CodeSandbox Demos](https://codesandbox.io/search?refinementList%5Bnpm_dependencies.dependency%5D%5B0%5D=polyrhythm&page=1&configure%5BhitsPerPage%5D=12)

# What It Is

`polyrhythm` is a TypeScript library with optional React bindings for coordinating multiple streams of async using RxJS Observables.

The goal of `polyrhythm` is to be a centralized control of timing for sync or async operations in your app. It achieves this through the pub-sub approach. You create named events on an Event Bus called a channel, and subscribers called filters and listeners respond to these events by invoking functions. Async concurrency is reduced to declaratively choosing a mode, instead of manually implementing queues, stacks, storing interval ids, and other error-prone techniques.

Its basic premises, which it will help to know, are:

- Command Object Pattern
- Pub Sub Pattern
- Actor Model
- Flux Standard Actions / Redux
- TC39 Observable proposal
- RxJS Concurrency operators

Like [Svelte](https://svelte.dev/) and [Elm](https://elm-lang.org/), `polyrhythm` envisions that different primitives can compose into more beautiful apps and User Experiences than the current Web platform allows. However, it does so using plain-old ES6 Javascript.

# Why You Might Want It

First of all, you want to build sophisticated UIs with arbitrarily precise timing, and robustness in the face of growing requirements. You want to solve problems like accounting for out-of-order async, build features like autocomplete controls or session timeouts, or control audio and animation like in games. Using `polyrhythm` you can build REST, React or WebSocket apps, client or server, or a 60fps game loops — using the exact same architecture.

# Where To Use It

`polyrhythm` can be used in a remote corner of your application, to solve a specific problem. Or it can scale up to be the framework upon which your entire application is built. The choice is up to you.

It is test-covered, production-tested, and performance-tested, but friendly enough for side projects. It only adds at most 5Kb to your bundle— so is relatively cheap to try out. There are demos showing its use in Node, React and VanillaJS. And its integrated TypeScript types and TypeDoc comments make it very TypeScript friendly (though I'm sure this could improve!).

# Declare Your Timing, Don't Code It

Most of the time, app code around timing is usually baked into the structure of applications, extremely hard to change. Either a function is async — and all its callers are — or it's not. Either you run your Promises in parallel using `Promise.all`, or you `await` them in a loop intentionally to run them serially. Changes to code built this way are non-trivial, with more time required to change than we would like.

`polyrhythm` gives you 5 concurrency modes you can plug in trivially as configuration parameters.

If async effects were sounds, this diagram shows how they might overlap/queue/cancel each other.

<a href="https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png"><img height="400" src="https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png"></a>

> Watch a [Loom Video on these concurrency modes](https://www.loom.com/share/3736003a75bd497eab062c97af0113fc)

This ensures that the structure of the code of your application is decoupled from its exact timing, and lets you write less, more managable code.

# Example: Ping Pong 🏓

Let's incrementally build a simple ping-pong app with it to show how it works. A game of ping-pong clearly has two actors, so will be a great Hello World...

## 1) Log all events, and trigger **ping**

According to Pub-Sub, there are publishers and subscribers. In `polyrhythm` there are ones who trigger, and ones who listen. Listeners control _effects_, triggerers originate _events_, and _behaviors_ tie them all together.

```js
const { filter, trigger } = require('polyrhythm');

// **** Behavior ****** //
filter(true, log);

// **** Events (type, payload) ****** //
trigger('ping', 'Hello World');
// { type: "ping", payload: "Hello World" }

// **** Effects ({ type, payload }) ****** //
function log({ type, payload }) {
  console.log(type, payload ? payload : '');
}
// Output:
// ping Hello World
```

This app logs all events, and triggers a single **ping** event, with a payload of `"Hello World"`, causing that to be printed.

**Explained:** Filters are functions that run before events go on the event bus. This makes filters great for logging, as you typically need some log output to tell you what caused an error, if an error occurs later. This filter's criteria is simply `true`, so it runs for all events. Strings, arrays of strings, Regex and boolean-functions are also valid kinds of criteria. The filter handler `log` recieves the event as an argument, so we destructure the `type` and `payload` from it, and send it to the console.

The `trigger` function is what put events onto the event bus. It accepts `type` and `payload` as separate arguments, reducing boilerplate a bit compared to Redux' `dispatch`. But if you want to pass a pre-assembled event, ala `dispatch`, that will work too. Let's continue...

## 2) Respond to **ping** with **pong**

If we just want to respond to a **ping** event with a **pong** event, we could do so in a filter. But filters should be reserved for synchronous side-effect functions like logging, or dispatching an event/action to a store. So let's use a different `polyrhythm` function with a similar API— `listen`:

```js
const { filter, listen, log, trigger } = require('polyrhythm');

filter(true, log);
listen('ping', () => {
  trigger('pong');
});

trigger('ping');
// Output:
// ping
// pong
```

Listeners are the workhorses of `polyrhythm`. Unlike filters, which run sequentially and before the event bus, listeners run independently and in parallel. And listeners cannot change events. If a listener has an error, that listener will be shut down, as though it alone blew a fuse.

But all we know for now, is that we have a **ping** event, and a **pong** reply. Now let's make this more realistic by making it last longer.

## 3) Return Async From an Event Handler

Normally in JavaScript things go fine—until we make something async. But `polyrhythm` has a solution for that, which starts with a simple utility function called `after`. I like to call `after` the `setTimeout` you always wanted.

Let's suppose we want to trigger a **pong** event, but it takes a second to do so. For async, we need two things: to import the `listen` and `after` functions, and return an Observable of the work to be done.

```js
const { filter, listen, log, after, trigger } = require('polyrhythm');

filter(true, log);
listen('ping', () => {
  return after(1000, () => trigger('pong'));
});

trigger('ping');
// Output: (1000 msec between)
// ping
// pong
```

In plain, readable code, `after` returns an Observable of the function call you pass as its 2nd argument, with the delay you specify as its 1st argument. It's the most readable syntax I've seen for this type of thing: _"After 1000 milliseconds, trigger `pong`"_

**TIP:** An object returned by `after` can be directly `await`-ed inside an async functions - it's a "thenable" Observable, as shown here:

```js
async function sneeze() {
  await after(1000, () => log('Ah..'));
  await after(1000, () => log('..ah..'));
  await after(1000, () => log('..choo!'));
}
```

**IMPORTANT:** All Observables, including those returned by `after`, are lazy. If you fail to return them to `polyrhythm`, or call `toPromise()` or `subscribe()` on them directly, they will not run! They are an unstarted, cancelable Task, and as we'll see, they allow for the most concurrency control.

But back to ping-pong, let's respond both to **ping** and **pong** now...

## 4) Ping-Pong forever!

Following this pattern of adding listeners, we can enhance the behavior of the app by adding another listener to `ping` it right back:

```js
const { filter, listen, log, after, trigger } = require('polyrhythm');

filter(true, log);
listen('ping', () => {
  return after(1000, () => trigger('pong'));
});
listen('pong', () => {
  return after(1000, () => trigger('ping'));
});

trigger('ping');
// Output: (1000 msec between each)
// ping
// pong
// ping
// pong  (etc...)
```

It works! But we can clean this code up. While we could use a Regex to match either **ping** or **pong**, a string array does the job just as well, and is more grep-pable. We'll write a `returnBall` function that can `trigger` either **ping** or **pong**, and wire it up.

```js
filter(true, log);
listen(['ping', 'pong'], returnBall);

trigger('ping');

function returnBall({ type }) {
  return after(1000, () => trigger(type === 'ping' ? 'pong' : 'ping'));
}
```

Now we have an infinite game, without even containing a loop in our app! Though we're dispensing with traditional control structures like loops, we're also not inheriting their inability to handle async, so our app's code will be more flexible and readable.

In ping-pong, running forever may be what is desired. But when it's not, or when parts of the app are shutdown, we'll want to turn off listeners safely.

## 5) Shutdown Safely (Game Over!)

While each listener can be individually shut down, when it's time to shut down the app (or in Hot Module Reloading scenarios), it's good to have a way to remove all listeners. The `reset` function does just this.

```js
const { filter, listen, log, after, reset, trigger } = require('polyrhythm');

filter(true, log);
listen(['ping', 'pong'], returnBall);

trigger('ping');
after(4000, reset).then(() => console.log('Done!'));

//Output:
// ping
// pong
// ping
// pong
// Done!
```

Now that's a concise and readable description of the app, at least in English. Read from top to bottom, it says:

> Log every event to the console. On a **ping** or a **pong**, return the ball with the opposite event. Start with a **ping**, and after 4000 milliseconds, stop listening, and log "Done!".

The function `after` returned an Observable of calling `reset` after 4 seconds. Then we called `then` on it, which caused `toPromise` to be invoked, which kicked off its subscription. And we're done!

**TIP:** To shut down an individual listener, `listen` returns an object that is disposable in the usual RxJS fashion:

```js
filter(true, log);
listen('ping', () => {
  return after(1000, () => trigger('pong'));
});
const player2 = listen('pong', () => {
  return after(1000, () => trigger('ping'));
});

trigger('ping');
after(4000, () => player2.unsubscribe()).then(() => console.log('Done!'));

//Output:
// ping
// pong
// ping
// pong
// Done!
```

Calling `unsubscribe()` causes the 2nd Actor/Player to leave the game, effectively ending the match, and completing the ping-pong example!

---

# Automate All The Things!

One of the most time-consuming parts of application development is manually running through the steps needed to test an application. With `polyrhythm` though, it's as easy to express the asynchronous scripts that exercise your app as it is to code the app itself! So I tend to build these scripts in parallel with the app, to save time and keystrokes. These scripts also can be moved into true tests.

To aid in creation of test scripts for `polyrhythm` re-exports the RxJS `concat` operator, which sequences Observables. A full script that starts up our Ping Pong, runs it a few seconcs, and shuts it down— takes just a few lines of code:

```js
const { filter, listen, log, after, concat, trigger } = require('polyrhythm');

filter(true, log);
const players = listen(/p[io]ng/, returnBall);

concat(
  after(0, () => log('Game on!')),
  after(0, () => trigger('ping')),
  after(4000, () => {
    players.unsubscribe();
    console.log('Done!');
  })
).toPromise();
```

The flow of events over time remains plainly visible. We listen and respond to **ping**s and **pong**s in a single listener and capture its Subscription as `players`. Then we create an Observable of the "Game on!" logging, the initial **ping**, and the shutdown. Then we just start it running by calling `toPromise()` upon it.

Also see [storybook-animate](https://github.com/deanius/storybook-animate) for an extension of this idea applied to StorybookJS.

# Polyrhythm - React Support

`useFilter` and `useListener` are React wrappers over the polyrhythm exported functions `filter` and `listen`. (Listen is aliased `on`, in honor of JQuery). What these wrapper hooks do is limit the lifetime of the event listener, and its side-effects, to the lifetime of the hosting component. These hooks will subscribe and unsubscribe to the channel as their component is (un)-mounted, or explicit `deps`, may be passed, so as not to close over stale values.

## Multiple Channel support

`useChannel` is available for more advanced scenarios where a different channel is desired, such as for keeping one sub-tree's events separated from the default, for privacy, simulating a server in-browser (!), or other reasons. (This feature is in progress/experimental).

# FAQ

**Got TypeScript typings?**

But of course!

**How large?**
16Kb parsed size, 5Kb Gzipped

**In Production Use?**
Yes.

**What does it do sync, async? With what Error-Propogation and Cancelability? How does it work?**

See [The test suite](/test/channel.test.ts) for details.

**How fast is it?**
Nearly as fast as RxJS. The [Travis CI build output](https://travis-ci.org/github/deanius/polyrhythm) contains some benchmarks.
