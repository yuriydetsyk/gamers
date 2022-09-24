import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class LocalStorageService {
    constructor() { }

    public get(key: string) {
        let value = localStorage.getItem(key);
        try {
            value = JSON.parse(value);
        } catch (error) {}

        return value;
    }

    public set(key: string, value: any) {
        try {
            value = JSON.stringify(value);
        } catch (error) {}

        localStorage.setItem(key, value);
    }
}
