import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';

@Component({
    selector: 'gw-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
    public isLogged: boolean;

    private subscription = new Subscription();

    constructor(private readonly tokenService: TokenService) { }

    public ngOnInit() {
        this.subscription.add(
            this.tokenService.isLogged$.subscribe((isLogged) => {
                this.isLogged = isLogged;
            })
        );
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
