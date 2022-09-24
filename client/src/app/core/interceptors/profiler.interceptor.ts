import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { finalize, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

@Injectable()
export class ProfilerInterceptor implements HttpInterceptor {
    public intercept(req: HttpRequest<any>, next: HttpHandler) {
        if (environment.production) {
            return next.handle(req);
        } else {
            const started = Date.now();
            let ok: string;

            return next.handle(req).pipe(
                tap(
                    (event: HttpEvent<any>) => ok = event instanceof HttpResponse ? 'succeeded' : '',
                    (error: HttpErrorResponse) => ok = 'failed'
                ),
                // Log when response observable either completes or errors
                finalize(() => {
                    const elapsed = Date.now() - started;
                    const msg = `${req.method} "${req.urlWithParams}" ${ok} in ${elapsed} ms.`;
                    console.log(msg);
                })
            );
        }
    }
}
