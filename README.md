[![npm version](https://badge.fury.io/js/polyrhythm.svg)](https://badge.fury.io/js/polyrhythm)[![<6 Kb](https://img.shields.io/badge/gzip%20size-%3C6%20kB-brightgreen.svg)](https://www.npmjs.com/package/polyrhythm)
[![Travis](https://img.shields.io/travis/deanius/polyrhythm.svg)](https://travis-ci.org/deanius/polyrhythm)
[![Maintainability](https://api.codeclimate.com/v1/badges/a99a88d28ad37a79dbf6/maintainability)](https://codeclimate.com/github/deanius/polyrhythm/maintainability)
[![TypeScript](https://badges.frapsoft.com/typescript/version/typescript-next.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)<a href="#badge"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"></a>[![twitter link](https://img.shields.io/badge/twitter-@deaniusol-55acee.svg)](https://twitter.com/deaniusol)

# Polyrhythm

A library with (optional) React bindings for coordinating multiple streams of async using RxJS Observables. Inspired by:

- 💙JQuery. No, really. See [#on](https://api.jquery.com/on/) and [#trigger](https://api.jquery.com/trigger/).
- 💜RxJS. Nearly as old as JQuery.
- 💜Redux-Observable. Async consequences of events.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [What Is It](#what-is-it)
- [Why You Might Need it](#why-you-might-need-it)
- [Concurrency Modes - Declarative timing control](#concurrency-modes---declarative-timing-control)
- [Polyrhythm - First Steps](#polyrhythm---first-steps)
  - [Installation](#installation)
  - [Code Example - Trigger Events](#code-example---trigger-events)
  - [Code Example - Respond to Events](#code-example---respond-to-events)
  - [React Component Layout](#react-component-layout)
  - [Code Example—Explanation](#code-exampleexplanation)
  - [React Hierarchy and Event Types](#react-hierarchy-and-event-types)
- [FAQ](#faq)
- [Examples](#examples)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# What Is It

A Domain Specific Language for building UIs.

All the good aspects of a Redux-like Command-Object pattern, plus an ability to control for async overlap in precise ways using Promises, or optimally using [RxJS Observables]().

# Why You Might Need it

First of all, you want to build sophisticated UIs with arbitrarily precise timing, and robustness in the face of growing requirments. You may have also started to encounter these limits with the ways many UI tools deal with async and effects.

- You like Promises, but don't like their lack of cancelability.
- You find React over-rendering happens too much, and props lists grow unchecked.
- You're frustrated with the code of React hooks to manage async (`useLayoutEffect` ?).
- You find React's async state-setting creating needless delay.
- You've used RxJS but didn't like managing subscription objects, or [figuring out which operator to use](https://www.slideshare.net/ladyleet/rxjs-operators-real-world-use-cases-full-version).
- You've never written a generator function ( `function*` ) and have no need to now, if its purpose can be obtained in a simpler way.
- You want to stick to the core JavaScript constructs, and suspect `async`/`await` is actually harmful.

Maybe you're a [Svelte](https://svelte.dev/), [CrankJS](https://crank.js.org/), or [Elm](https://elm-lang.org/) fan who wants to get those benefits in plain ES6 Javascript. Or you like the musical name and metaphors of polyrhythm. Whatever your reason might be, I've had a blast building stuff with it, much of which I'll upload into [The Showcase](http://todo.org) as I update them all to 1.0.0 syntax. And like all things in rhythm, it all begins with solid control of _timing_.

---

# Concurrency Modes - Declarative timing control

Did you know that browsers have a limited # of connections allowed they can use at a time? Ask me how I found out when some of my Google Analytics events got dropped due to event-firing happening too often 😅! App behaviors like this are usually baked into the structure of applications, thus hard to change. But **polyrhythm** gives you 5 concurrency modes you can plug in trivially as configuration parameters. For example, to ensure that Google Analytics traffic buffers up on a queue so that it uses only one connection, just add a ListenerConfig object with a different `mode` than the default.

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
import { trigger } from 'polyrhythm'

const AutoComplete = () => (<input type="text"
    onChange={({ target }) => {
        trigger("text/change", { value: target.value})
    }}>)
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

  useListener(
    'text/change',
    ({ payload: { value: search } }) => {
      return ajax.get(`http://osolem.io/?${search}`).pipe(
        map(({ response }) => response.data),
        tap(data => setResults(data))
      );
    },
    { mode: 'replace' }
  );
  // return <ul> mapped over results as <li/>
};
```

Outside of React, the functions `trigger`, `listen` and `filter` work with the same arguments as shown above, so polyrhythm can be useful in any JavaScript environment, or even to communicate between JavaScript techs in the same app.

## Flexible Component Layout

The components are connected strictly through the `type`s of events they `trigger` and `listen` for, not through any parent-child coupling. The components are in need of fewer props of each other, since the event bus severs their dependency. Easier code refactoring and improved reuse as a result.

```.js
<Form>
  <AutoComplete/>
  <AutoResults/>
</Form>
```

<details>
<summary>And there you have an autocomplete, the Hello World of RxJS!</summary>

![](https://johnjohnston.info/106/wp-content/uploads/2013/12/google_autocomplete.gif)

</details>

## Code Example—Explanation

The listener returns the Observable of (ajax work + setState) and it is subscribed to according one of the 5 timing / concurrency strategies ("replace") by the framework. No explicit subscription management is needed on the part of the caller. This is because the entire listener is one Subscription which will be unsubscribed on unmount (or when the provided `deps` change).

The "replace" mode (ala RxJS' switchMap), cancels the previous XHR request immediately upon each new text change. This Observable could include a debounce time in it to make it just a bit more polished ;) But the ability to "plug-in" the concurrency mode independent from the rest of the code is what makes finding the solution to 95% of the most common UI timing issues easy.

## React Lifecycle and memoization

The imports `trigger` and `useListener` are bound to the default event bus called a Channel. Because `trigger` is a static import it need not be passed as a prop between components.

The components containing them need not have any parent-child relationship in the React hierarchy or pass props between them. They're cooperating via the string `type` value of `text/change` - (or via an all-caps constant if you prefer).

`useListener` will subscribe and unsubscribe as its component is in (un)-mounted so as not to leak memory. _Any in-flight async effects, if they are returned Observables from listeners, will be canceled upon unmount!_

`useChannel` is available for more advanced scenarios where a different channel is desired, such as for keeping one sub-tree's events separated from the default, for privacy, simulating a server in-browser (!), or other reasons.

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
Nearly as fast as [RxJS](). But since performance tends to change (degrade) over time, the [Travis CI build output](https://travis-ci.org/github/deanius/polyrhythm) contains some benchmarks.

**I want more examples!**

So you want to know what else can be done? I'm in the process of migrating things, so bear with me, and I apologize in advance that I'm not a CSS wizard, it's not where I spend my time!

# Examples

- [A basic working React integration](https://codesandbox.io/s/polyrhythm-react-integration-jwqwe)
- [A (streaming) autocomplete over the Google Books API](https://codesandbox.io/s/book-streamer-w1t8o)
- [`concatMap`, meet the `serial` ConcurrencyMode](https://codesandbox.io/s/polyrhythm-serial-mode-scroller-r94fj)
- [`after`, the setTimeout you always wanted](/test/utils.test.ts)
- [An illustrated demo of the ConcurrencyMode concept](https://codesandbox.io/s/polyrhythm-ny-countdown-e5itf)
- [An elegant solution to when the UI changes out from under you when you're about to click something, and it moves](https://codesandbox.io/s/debounced-ui-d052f)
- See [All CodeSandbox Demos](https://codesandbox.io/search?refinementList%5Bnpm_dependencies.dependency%5D%5B0%5D=polyrhythm&page=1&configure%5BhitsPerPage%5D=12)
