import { Component } from '@angular/core';

import { LoaderService } from '../../../../../core/services/loader.service';

@Component({
    selector: 'gw-loading',
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.scss']
})
export class LoadingComponent {
    public isLoading = this.loaderService.isLoading;

    constructor(private readonly loaderService: LoaderService) { }
}
