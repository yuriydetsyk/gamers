import { HttpErrorResponse, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    public intercept(req: HttpRequest<any>, next: HttpHandler) {
        return next.handle(req).pipe(
            retry(2),
            catchError((error: HttpErrorResponse) => {
                if (error.status !== 401) {
                    // 401 handled in auth.interceptor
                    console.log(error.message);
                }
                return throwError(error);
            })
        );
    }
}
