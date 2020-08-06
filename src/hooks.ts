/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useContext, createContext } from 'react';
import {
  channel as defaultChannel,
  EventMatcher,
  Filter,
  Listener,
  ListenerConfig,
} from './channel';
import { Subscription } from 'rxjs';

interface ListenerConfigWithDeps extends ListenerConfig {
  deps?: Array<any>;
}

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
    useListener(
      eventSpec: EventMatcher,
      handler: Listener,
      options: ListenerConfig = {}
    ) {
      useEffect(() => {
        const sub = channel.on(eventSpec, handler, options);
        return () => sub.unsubscribe();
      }, deps);
    },
    useFilter(eventSpec: EventMatcher, filter: Filter) {
      useEffect(() => {
        const sub = channel.filter(eventSpec, filter);
        return () => sub.unsubscribe();
      }, deps);
    },
  };
};

/** Allows a component to attach (maybe async) consequences
 * to event patterns: strings, regexes, or function predicates.
 * Handlers return Observables for flexible scheduling/cancelation.
 * Cleans up when the component is unmounted.
 * @argument eventSpec - the criteria for the event to listen for
 * @argument handler - the function to be run upon the event, after all filters
 * @argument options - If the handler closes over React hook variables which
 * are not stable, provide the variables in the `deps` field of this object.
 * @returns A ref to a subscription, on which you may invoke .current.unsubscribe()
 */
export const useListener = (
  eventSpec: EventMatcher,
  handler: Listener,
  options: ListenerConfigWithDeps = {}
) => {
  const { deps = [], ...config } = options;
  const subscriptionRef = useRef(new Subscription(() => null));

  useEffect(() => {
    const subscription = defaultChannel.on(eventSpec, handler, config);
    subscriptionRef.current = subscription;
    return () => subscription.unsubscribe();
  }, deps);

  return subscriptionRef;
};

/** Allows a component to intercept and run synchronous
 consequences, alter events, or throw errors to cancel the processing
 * @argument eventSpec - the criteria for the event to listen for
 * @argument handler - the function to be run synchronously upon the event before all listeners
 * @argument options - If the handler closes over React hook variables which
 * are not stable, provide the variables in the `deps` field of this object.
*/
export const useFilter = (
  eventSpec: EventMatcher,
  handler: Listener,
  options: ListenerConfigWithDeps = {}
) => {
  const { deps = [] } = options;
  const subscriptionRef = useRef(new Subscription(() => null));

  useEffect(() => {
    const subscription = defaultChannel.filter(eventSpec, handler);
    subscriptionRef.current = subscription;
    return () => subscription.unsubscribe();
  }, deps);

  return subscriptionRef;
};

/** More readable version of useEffect(fn, []). Only on run at mount time. */
export const useEffectAtMount = (fn: React.EffectCallback) => useEffect(fn, []);

/** Run upon every render after the mount, subject to its deps */
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
