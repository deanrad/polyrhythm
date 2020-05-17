[![npm version](https://badge.fury.io/js/polyrhythm.svg)](https://badge.fury.io/js/polyrhythm)[![<6 Kb](https://img.shields.io/badge/gzip%20size-%3C6%20kB-brightgreen.svg)](https://www.npmjs.com/package/polyrhythm)
[![Travis](https://img.shields.io/travis/deanius/polyrhythm.svg)](https://travis-ci.org/deanius/polyrhythm)
[![Maintainability](https://api.codeclimate.com/v1/badges/a99a88d28ad37a79dbf6/maintainability)](https://codeclimate.com/github/deanius/polyrhythm/maintainability)
[![TypeScript](https://badges.frapsoft.com/typescript/version/typescript-next.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)<a href="#badge"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"></a>[![twitter link](https://img.shields.io/badge/twitter-@deaniusol-55acee.svg)](https://twitter.com/deaniusol)

# Polyrhythm

Polyrhythm is a Domain Specific Language for building UIs with JavaScript.

Inspired by:

- 💙JQuery. No, really. See [#on](https://api.jquery.com/on/) and [#trigger](https://api.jquery.com/trigger/).
- 💜RxJS. Nearly as old as JQuery.
- 💜Redux-Observable. Async consequences of events.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [What Is It](#what-is-it)
- [Why You Might Want It](#why-you-might-want-it)
- [Concurrency Modes - Declarative timing control](#concurrency-modes---declarative-timing-control)
- [Polyrhythm - First Steps](#polyrhythm---first-steps)
  - [Installation](#installation)
  - [Code Example - Trigger Events](#code-example---trigger-events)
  - [Code Example - Respond to Events](#code-example---respond-to-events)
  - [Code Example — Explanation](#code-example--explanation)
- [Polyrhythm - Core Concepts](#polyrhythm---core-concepts)
  - [The Channel](#the-channel)
  - [Filters and Listeners](#filters-and-listeners)
  - [Multiple Channel support](#multiple-channel-support)
- [FAQ](#faq)
- [Examples](#examples)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# What Is It

Polyrhythm is a TypeScript library with optional React bindings for coordinating multiple streams of async using RxJS Observables.

It's got all the good aspects of a Redux-like Command-Object pattern, plus an ability to control for async overlap in precise ways. It builds upon and uses [RxJS Observables](https://github.com/tc39/proposal-observable), and is compatible with Promises without requiring any functions to be marked `async`.

Like [Svelte](https://svelte.dev/), [CrankJS](https://crank.js.org/), and [Elm](https://elm-lang.org/), polyrhythm envisions that different primitives can compose into more beautiful apps and User Experiences than the current Web platform allows, and it does so using plain ES6 Javascript.

# Why You Might Want It

First of all, you want to build sophisticated UIs with arbitrarily precise timing, and robustness in the face of growing requirements. You want to solve problems like accounting for out-of-order async, build features like autocomplete controls or session timeouts, or control audio and animation like in games. You may have also started to encounter these limits with the ways many UI tools deal with async, animations, and effects, for instance:

- You've found React's asynchronous setState to be a source of bugs and edge cases.
- You find your React's prop-lists growing, and want to pass fewer props than you currently must.
- You find React's async state-setting creating delay and resource leaks.
- You find Promise's lack of cancelability a poor use of resources.
- You've used RxJS but found it hard to manage subscription objects, or choose between the `(concat|merge|flat|exhaust|switch)Map` operators.
- You liked the directness of JQuery events, and think in terms of cause=>effect.
- You want to deal with audio or animations-inherently async-and create bulletproof chains of behavior that are robust in the face of timing issues and errors.

Maybe you like the musical name and metaphors of polyrhythm. Whatever your reason might be, I've had a blast building it, and making stuff with it, much of which I'll upload into [The Showcase](http://todo.org) as I update them all to 1.0.0 syntax.

Now—to understand (poly)rhythm, one needs a solid command of _timing_.

---

# Concurrency Modes - Declarative timing control

App code around timing is usually baked into the structure of applications, extremely hard to change. Either a function is async — and all its callers are — or it's not. Either you run your Promises in parallel using `Promise.all`, or you `await` them in a loop intentionally to run them serially. Changes to code built this way are non-trivial ones with more time required to change than we would like.

But **polyrhythm** gives you 5 concurrency modes you can plug in trivially as configuration parameters. For example, to ensure that Google Analytics traffic buffers up on a queue so that it uses only one connection, just add a ListenerConfig object with a different `mode` than the default.

```js
listen(
  'user/click',
  event => {
    return sendGoogleAnalytics(event.payload);
  },
  { mode: 'serial' }
);
```

And you're done. There's no impact on what the sendGoogleAnalytics function does to switch modes. It simply returns an Observable (or deferred Promise) of its work that already allows for its own cancelability and you're done. You could even detect at runtime if there's sufficient bandwidth and change the mode to `parallel` on the fly, by resubscribing the listener with a different mode. This lets you avoid painting yourself into a corner with your initial choice - instead of timing control defining the shape of your app, you plug in any of these well-tested modes at will. Happier users are the result!

If async effects were sounds, this diagram shows how they might overlap/queue/cancel each other.

<a href="https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png"><img height="400" src="https://s3.amazonaws.com/www.deanius.com/ConcurModes2.png"></a>

> Watch a [Loom Video on these concurrency modes](https://www.loom.com/share/3736003a75bd497eab062c97af0113fc)

---

# Polyrhythm - First Steps

## Installation

```
npm install polyrhythm rxjs
```

## Code Example - Trigger Events

Trigger events with named `type` fields, and arbitrary payloads from event handlers, or async effects:

```js
import { trigger } from 'polyrhythm';

const AutoCompleteInput = () => {
  return (
    <input
      type="text"
      onChange={({ target: { value } }) => {
        trigger('text/change', { value });
      }}
    />
  );
};
```

## Code Example - Respond to Events

Respond to them in the same, or other components using `useListener` or `useFilter`:

```js
import { useState } from 'react';
import { useListener, ConcurrencyMode } from 'polyrhythm';
import { ajax } from 'rxjs';
import { map, tap } from 'rxjs/operators';

/* The 'replace' mode combines overlapping listeners as RxJS switchMap. */
/* Others are 'toggle', 'ignore', 'serial' and 'parallel' */
const AutoCompleteResults = () => {
  const [results, setResults] = useState([]);
  // Apply AJAX results to local state
  useFilter('autocomplete/results', ({ payload: data }) => {
    setResults(data);
  });

  // Map text/change events to autocomplete/result events, with cancelation
  useListener(
    'text/change',
    ({ payload: { value: search } }) => {
      return ajax.get(`http://osolem.io/?${search}`).pipe(
        map(({ response }) => response.data),
        tap(data => trigger('autocomplete/results', data))
      );
    },
    { mode: 'replace' }
  );

  //prettier-ignore
  return <ul>{ results.map(result => <li>{result}</li>) } }</ul>
};
```

Outside of React, the functions `trigger`, `listen` and `filter` work with the same arguments as shown above, so polyrhythm can be useful in any JavaScript environment, or even to communicate between distinct JavaScript technologies in the same app.

## Code Example — Explanation

The component tree is the following:

```js
<Form>
  <AutoCompleteInput />
  <AutoCompleteResults />
</Form>
```

The components are connected strictly through the `type`s of events they `trigger` and `listen` for, not through any parent-child coupling. The components are in need of fewer props of each other, since the event bus severs their dependency. Easier code refactoring and improved reuse as a result.

The `AutoCompleteInput` triggers events of type `text/change` upon changes to its input box. It is merely a source of events, and `AutoCompleteResults` has a listener for these events.

The listener for `text/change` fires off Ajax requests on each one, but specifies the mode `replace`, so new `text/change` events cancel the old AJAX request and "replace" it with a new search. The AJAX' completion is marked by triggering an `autocomplete/results` with the result data becoming the `payload` of the event.

The ability to "plug-in" the concurrency mode independent from the rest of the code makes coding the solution to 95% of the most common UI timing issues a piece of cake. And the ability to depend upon events by name, as well as call `trigger` from anywhere, can reduce the need to pass props, avoiding entire classes of memoization and over-rendering issues that can result from how props are passed.

And there you have an autocomplete, the Hello World of Polyrhythm!

# Polyrhythm - Core Concepts

## The Channel

The exported functions `trigger`, `useFilter` and `useListener` are bound to the default event bus called a Channel.

## Filters and Listeners

The difference between a filter and a listener is how and when they run.

Filters are run prior to all listeners, synchronously, and sequentially. They can alter the event stream of a channel. An analogy to audio filters is apropos. If a filter throws an error, no downstream listeners will receive that event.

Listeners are run independently of each other. If a listener has an error, that error will not be visible to the one who called `trigger`, nor interfere with other listeners. Furthermore that listener will be unsubscribed, as though it blew a fuse. An analogy applies to an audio sound-board with outputs to PA speakers, and to a recording device. If your recording device output blows a fuse, you'd still probably like the reset of the system to continue operating.

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

Oh, you've come to the right place. [The test suite](/test/channel.test.ts) will explain.

**How fast is it?**
Nearly as fast as RxJS. But since performance tends to change (degrade) over time, the [Travis CI build output](https://travis-ci.org/github/deanius/polyrhythm) contains some benchmarks.

**I want more examples!**

Help by building some :)

# Examples

- [A basic working React integration](https://codesandbox.io/s/polyrhythm-react-integration-jwqwe)
- [A VanillaJS (non-React) version](https://codesandbox.io/s/polyrhythm-ping-pong-mcrh9)
- [A (streaming) autocomplete over the Google Books API](https://codesandbox.io/s/book-streamer-w1t8o)
- [`concatMap`, meet the `serial` ConcurrencyMode](https://codesandbox.io/s/polyrhythm-serial-mode-scroller-r94fj)
- [`after`, the setTimeout you always wanted](/test/utils.test.ts)
- [A remake of RxJS Drag & Drop](https://codesandbox.io/s/polyrhythm-drag-drop-os8n7?file=/src/index.js)
- [An illustrated demo of the ConcurrencyMode concept](https://codesandbox.io/s/polyrhythm-ny-countdown-e5itf)
- [An elegant solution to when the UI changes out from under you when you're about to click something, and it moves](https://codesandbox.io/s/debounced-ui-d052f)
- See [All CodeSandbox Demos](https://codesandbox.io/search?refinementList%5Bnpm_dependencies.dependency%5D%5B0%5D=polyrhythm&page=1&configure%5BhitsPerPage%5D=12)
