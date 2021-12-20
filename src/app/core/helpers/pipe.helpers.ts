import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, take, tap } from 'rxjs/operators';

import { LoaderService } from '../services/loader.service';

@Injectable({
    providedIn: 'root'
})
export class PipeHelpers {
    constructor(private readonly loaderService: LoaderService) { }

    public startRequestPipe: <T>(source: Observable<T>) => Observable<T> = (source) => source.pipe(
        tap(() => this.loaderService.addRequest()),
        take(1)
    )

    public endRequestPipe: <T>(source: Observable<T>) => Observable<T> = (source) => source.pipe(
        finalize(() => this.loaderService.removeRequest()),
        catchError((error) => {
            console.log(error.message);
            return throwError(error);
        })
    )
}
