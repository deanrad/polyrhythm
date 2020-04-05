import React, { useEffect, useRef, useContext, createContext } from 'react';
import {
  agent as defaultChannel,
  EventMatcher,
  Subscriber,
  HandlerConfig,
} from 'rx-helper';

// Call this anywhere in the tree to ensure that useListener/on, and trigger
// are bound to this agent

// Import ChannelContext and wrap YourComponent:
//
//  <ChannelContext.Provider value={yourChannel}>
//    <YourComponent/>
//  </ChannelContext.Provider>

// In YourComponent:
// const { trigger, on } = useChannel()
export const ChannelContext = createContext(defaultChannel);

export const useChannel = (deps = []) => {
  const channel = useContext(ChannelContext) || defaultChannel;
  return {
    trigger(type: string, payload?: any) {
      channel.trigger(type, payload);
    },
    on(
      eventSpec: EventMatcher,
      handler: Subscriber,
      options: HandlerConfig = {}
    ) {
      useEffect(() => {
        const sub = channel.on(eventSpec, handler, options);
        return () => sub.unsubscribe();
      }, deps);
    },
    filter(
      eventSpec: EventMatcher,
      handler: Subscriber,
      options: HandlerConfig = {}
    ) {
      useEffect(() => {
        const sub = channel.filter(eventSpec, handler, options);
        return () => sub.unsubscribe();
      }, deps);
    },
  };
};

/** useListener: Allows a component to attach (maybe async) consequences
 * to event patterns: strings, regexes, or function predicates.
 * Handlers return Observables for flexible scheduling/cancelation.
 * Cleans up when the component is unmounted.
 * @argument eventSpec - the string or regex to match the event type
 * @argument handler - the function to be run (receiving {event})
 * @argument options - If the handler closes over React hook variables which
 * are not stable, provide the variables in the `deps` field of this object.
 */
export const useListener = (
  eventSpec: EventMatcher,
  handler: Subscriber,
  options: HandlerConfig = {}
) => {
  const { deps = [], agent = defaultChannel, ...config } = options;

  useEffect(() => {
    const subscription = agent.on(eventSpec, handler, config);

    return () => subscription.unsubscribe();
  }, deps);
};

/** useListener: Allows a component to intercept and run synchronous
 consequences, alter events, or throw errors to cancel the processing
*/
export const useFilter = (
  eventSpec: EventMatcher,
  handler: Subscriber,
  options: HandlerConfig = {}
) => {
  const { deps = [], agent = defaultChannel, ...config } = options;

  useEffect(() => {
    const subscription = agent.filter(eventSpec, handler, config);

    return () => subscription.unsubscribe();
  }, deps);
};

export const useEffectAtMount = (fn: React.EffectCallback) => useEffect(fn, []);

export const useEffectAfterMount = (
  func: React.EffectCallback,
  deps: React.DependencyList = []
) => {
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current !== false) {
      func();
    } else {
      didMount.current = true;
    }
  }, deps);
};

export const channel = defaultChannel;
export * from 'rx-helper';
