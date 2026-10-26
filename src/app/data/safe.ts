import { Observable, catchError, of } from 'rxjs';

/** Para tableros que combinan varias fuentes: una que falla queda en null y no tumba a las demás. */
export function orNull<T>(source: Observable<T>): Observable<T | null> {
  return source.pipe(catchError(() => of(null)));
}
