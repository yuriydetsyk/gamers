import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { LoaderService } from '../services/loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
    constructor(private readonly loaderService: LoaderService) { }

    public intercept(req: HttpRequest<any>, next: HttpHandler) {
        this.loaderService.addRequest();
        return next.handle(req).pipe(
            finalize(() => this.loaderService.removeRequest())
        );
    }
}
