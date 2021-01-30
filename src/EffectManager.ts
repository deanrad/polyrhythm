import { Observable, ObservableInput, Subscription, Observer } from 'rxjs';
import { switchMap, mergeMap, concatMap, exhaustMap } from 'rxjs/operators';

/**
 * A function returning an Observable representing an effect.
 * Also may return Promises, generators, per RxJS' ObservableInput type.
 */
interface EffectFactory<T, U> {
  (item: T): ObservableInput<U>;
}

/**
 * Defines an extended Observer whose next methods themselves return Observables.
 */
interface EffectFactoryObserver<T, U> {
  next: EffectFactory<T, U>;
  complete?: Observer<T>['complete'];
  error?: Observer<T>['error'];
}

/** Defines an Effect execution container, applies a given concurrency strategy
 * to the Observables yielded by a given EffectFactory Function.
 * @example: const serialAjaxSub = new QueuingEffectManager(from([1,2,3])).subscribe({ next(v){ return ajax(url, {v}) }});

 */
interface EffectManager<T> {
  subscribe<U>(effectObserver: EffectFactoryObserver<T, U>): Subscription;
}

class EffectManagerBase<T> implements EffectManager<T> {
  constructor(
    protected stream: Observable<T>,
    protected combiner: typeof switchMap
  ) {}

  subscribe<U>(effectObserver: EffectFactoryObserver<T, U>) {
    //prettier-ignore
    return this.stream
          .pipe(this.combiner(effectObserver.next))
          .subscribe({
            complete: effectObserver.complete,
            error: effectObserver.error || (() => null),
          });
  }
}

/** An EffectManager that replaces any existing effect execution by
 * canceling it, and starting a new one. switchMap.
 * */
export class ReplacingEffectManager<T> extends EffectManagerBase<T> {
  constructor(stream: Observable<T>) {
    super(stream, switchMap);
  }
}

/** An EffectManager that begins effects ASAP with unbounded concurrency. mergeMap.
 * */
export class ASAPEffectManager<T> extends EffectManagerBase<T> {
  constructor(stream: Observable<T>) {
    super(stream, mergeMap);
  }
}

/** An EffectManager that queues effects without bound. concatMap.
 * */
export class QueuingEffectManager<T> extends EffectManagerBase<T> {
  constructor(stream: Observable<T>) {
    super(stream, concatMap);
  }
}

/** An EffectManager that does not begin effects if one was executing. exhaustMap.
 * */
export class ThrottlingEffectManager<T> extends EffectManagerBase<T> {
  constructor(stream: Observable<T>) {
    super(stream, exhaustMap);
  }
}
