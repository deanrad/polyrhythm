[![npm version](https://badge.fury.io/js/polyrhythm.svg)](https://badge.fury.io/js/polyrhythm)[![<6 Kb](https://img.shields.io/badge/gzip%20size-%3C6%20kB-brightgreen.svg)](https://www.npmjs.com/package/polyrhythm)
[![Travis](https://img.shields.io/travis/deanius/polyrhythm.svg)](https://travis-ci.org/deanius/polyrhythm)
[![TypeScript](https://badges.frapsoft.com/typescript/version/typescript-next.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)<a href="#badge"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"></a>[![twitter link](https://img.shields.io/badge/twitter-@deaniusol-55acee.svg)](https://twitter.com/deaniusol)

# Polyrhythm

A library with (optional) React bindings for coordinating multiple streams of async using RxJS Observables. Inspired by:

- 💙JQuery. No, really. See [#on](https://api.jquery.com/on/) and [#trigger](https://api.jquery.com/trigger/).
- 💜RxJS. Nearly as old as JQuery.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Polyrhythm](#polyrhythm)
  - [Code Example](#code-example)
  - [Code Example—Explanation](#code-exampleexplanation)
  - [React Hierarchy and Event Types](#react-hierarchy-and-event-types)
- [Why You Might Want To Use It](#why-you-might-want-to-use-it)
- [Installation](#installation)
- [FAQ](#faq)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
# Polyrhythm
## Code Example

Trigger events with named `type` fields, and arbitrary payloads from event handlers, or async effects:

```js
import { trigger } from 'polyrhythm'

const AutoComplete = () => (<input type="text"
    onChange={({ target }) => {
        trigger("text/change", { value: target.value})
    }}>)
```

Respond to them in other components using `useListener` or `useFilter`:

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
<details>
<summary>And there you have an autocomplete, the Hello World of RxJS!</summary>

![](https://johnjohnston.info/106/wp-content/uploads/2013/12/google_autocomplete.gif)
</details>

## Code Example—Explanation

The listener returns the Observable of (ajax work + setState) and it is subscribed to according one of the 5 timing / concurrency strategies ("replace") by the framework. No explicit subscription management is needed on the part of the caller. This is because the entire listener is one giant Subscription which will be unsubscribed on unmount (or when the provided `deps` change).

The "replace" mode (ala RxJS' switchMap), cancels the previous XHR request immediately upon each new text change. Like adding a string quartet arrangement to a piece of music to finish it off, this Observable could include a debounce time in it to make it just a bit more polished ;) But the decoupling of the concurrency mode from the rest of the code, and making it available declaratively is very convenient.

## React Hierarchy and Event Types

The imports `trigger` and `useListener` are bound to the default event bus called a Channel. The components containing them need not have any parent-child relationship in the React hierarchy or pass props between them. They're cooperating via the string `type` value of `text/change` - (or via an all-caps constant if you prefer).

Because `trigger` is a static import it needn't be passed as a prop between components. `useListener` will subscribe and unsubscribe as the component it is in (un)-mounted so as not to leak memory. _Any in-flight async effects, if they are returned Observables from listeners, will be canceled upon unmount!_

`useChannel` is available for more advanced scenarios where a different channel is desired, such as for keeping one sub-tree's events separated from the default, for privacy or whatever reasons.

# Why You Might Want To Use It

- You're frustrated with the code of React hooks to manage async.
- You think `useLayoutEffect` is confusing terminology
- You find React over-rendering happens because function props defeat memoization.
- You find React's async state-setting annoying at best, and downright incorrect at worst.
- You want to stick to the core JavaScript constructs, and suspect `async`/`await` is actually harmful.
- You've never written a generator function ( `function*` ) and have no need to now, if its purpose can be obtained a structurally simpler way.
- You like Promises, but don't like their lack of cancelability,
- You want to build sophisticated UIs with arbitrarily precise timing control that Promises don't give you.
- You've used RxJS but didn't like managing subscription objects, or [figuring out which operator to use](https://www.slideshare.net/ladyleet/rxjs-operators-real-world-use-cases-full-version).

Maybe you're just a [crank](https://crank.js.org/), or you walked into an [Elm](https://elm-lang.org/) tree. Or you like the musical name and metaphors and want to cross-pollinate those musical centers of your brain while coding. I don't know, but I've had a blast building stuff with it, much of which I'll upload into [The Showcase](http://todo.org) as I update them all to 1.0.0 syntax from a couple of years of iterating toward this one, which is now looking to be very stable (thus the 1.0.0! 🏆)

---
# Installation

```
npm install polyrhythm rxjs
```

Then use as the examples show.

---

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

- [A basic working React integration](https://codesandbox.io/s/polyrhythm-react-integration-jwqwe)
- [A (streaming) autocomplete over the Google Books API](https://codesandbox.io/s/book-streamer-w1t8o)
- [An illustrated demo of the ConcurrencyMode concept](https://codesandbox.io/s/polyrhythm-ny-countdown-e5itf)
- [An elegant solution to when the UI changes out from under you when you're about to click something, and it moves](https://codesandbox.io/s/debounced-ui-d052f)
- [A speech API demo with "serial" concurrency (TODO)]()
- [`after`, the setTimeout you always wanted](/test/utils.test.ts)
- See [All CodeSandbox Demos](https://codesandbox.io/search?refinementList%5Bnpm_dependencies.dependency%5D%5B0%5D=polyrhythm&page=1&configure%5BhitsPerPage%5D=12)
