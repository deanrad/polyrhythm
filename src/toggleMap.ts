// @ts-nocheck
import { Observable, Subscription } from 'rxjs';

export interface Spawner {
  (event: Event): Observable<any>;
}

// The missing *Map operator. Acts like a pushbutton toggle
// wrt to a returned Observable - one will be canceled if its running,
// one will only be started if it wasn't running!
//prettier-ignore
export const toggleMap = (
  spawner: Spawner,
  mapper = (_:any, inner:any) => inner
) => {
  return function(source: Observable<any>) {
    return new Observable(observer => {
      let innerSub: Subscription;
      return source.subscribe({
        next(trigger) {
          if (!innerSub || innerSub.closed) {
            innerSub = spawner(trigger).subscribe(
              inner => observer.next(mapper(trigger, inner)),
              e => observer.error(e)
            );
          } else {
            innerSub.unsubscribe();
          }
        },
        error(e) {
          observer.error(e);
        },
        complete() {
          observer.complete();
        }
      });
    });
  };
};
