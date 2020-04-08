// @ts-nocheck
import { Observable, Subscription } from "rxjs";

interface Spawner {
  (event: Event): Observable<any>;
}

// The missing *Map operator. Acts like a pushbutton toggle
// wrt to a returned Observable - one will be canceled if its running,
// one will only be started if it wasn't running!
export const toggleMap = (
  spawner: Spawner,
  mapper = (outer, inner) => inner
) => {
  return function(source) {
    return new Observable(observer => {
      let innerSub: Subscription;
      return source.subscribe({
        next(outer) {
          if (!innerSub || innerSub.closed) {
            innerSub = spawner(outer).subscribe(
              inner => observer.next(mapper(outer, inner)),
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