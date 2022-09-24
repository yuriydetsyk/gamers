import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class HttpService {
    constructor(private readonly http: HttpClient) { }

    public get(url: string) {
        return this.http.get(url);
    }

    public getPlain(url: string) {
        return this.http.get<string>(url, { responseType: 'text' as 'json' });
    }

    public post(url: string, body: any) {
        return this.http.post(url, body);
    }
}
