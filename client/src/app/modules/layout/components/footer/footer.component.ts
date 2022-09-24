import { Component } from '@angular/core';

import { Copyright } from '../../../../models/copyright.model';

@Component({
    selector: 'gw-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
    public currentYear = new Date().getFullYear();
    public copyright = new Copyright({
        authorName: 'Yuriy D',
        authorCompanyName: 'Chunkup',
        authorCompanyUrl: 'https://chunkup.com'
    });
}
