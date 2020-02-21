import { useEffect, useRef } from 'react';
import {
  agent as defaultAgent,
  EventMatcher,
  Subscriber,
  HandlerConfig,
} from 'rx-helper';

/** useListener: Allows a component to attach (maybe async) consequences
 * to event patterns: strings, regexes, or function predicates.
 * Handlers return Observables for flexible scheduling/cancelation.
 * Cleans up when the component is unmounted.
 * @argument eventSpec - the string or regex to match the event type
 * @argument handler - the function to be run (receiving {event})
 * @argument options - If the handler closes over React hook variables which
 * are not stable, provide the variables in the `deps` field of this object.
 * To listen to an agent other than
 */
export const useListener = (
  eventSpec: EventMatcher,
  handler: Subscriber,
  options: HandlerConfig = {}
) => {
  const { deps = [], agent = defaultAgent, ...config } = options;

  useEffect(() => {
    const subscription = agent.on(eventSpec, handler, config);

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

export * from 'rx-helper';
