import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { html, stripIndents } from 'common-tags';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { getLayoutData } from './core/helpers/route.helpers';
import { isNil } from './core/helpers/type.helpers';
import { LoaderService } from './core/services/loader.service';
import { LocalStorageService } from './core/services/local-storage.service';
import { NotificationService } from './core/services/notification.service';
import { Language } from './models/enums/language.enum';
import { NotificationLocation } from './models/enums/notification-location.enum';
import { StorageKey } from './models/enums/storage-key.enum';
import { Notification } from './models/interfaces/notification.interface';

@Component({
    selector: 'gw-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
    public showHeader = true;
    public showSidebar = false;
    public showFooter = false;
    public lastNotification: Notification;
    public lastNotificationTimeout: number;
    public NotificationLocation = NotificationLocation;

    private destroy$ = new Subject<void>();

    constructor(
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly loaderService: LoaderService,
        private readonly translateService: TranslateService,
        private readonly localStorageService: LocalStorageService,
        private readonly notificationService: NotificationService
    ) { }

    public ngOnInit() {
        this.initLanguage();
        this.initDynamicLayout();

        this.notificationService.lastNotification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((notification) => {
                this.lastNotification = notification;

                if (this.lastNotificationTimeout) {
                    window.clearTimeout(this.lastNotificationTimeout);
                }
                this.lastNotificationTimeout = window.setTimeout(() => {
                    this.lastNotification = null;
                },
                    this.notificationService.notificationDuration
                );
            });
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public getStrippedContent(message: string) {
        return html(stripIndents(message));
    }

    public getNotificationClass(notification: Notification) {
        return this.notificationService.getNotificationClass(notification);
    }

    private initLanguage() {
        // this language will be used as a fallback when a translation isn't found in the current language
        this.translateService.setDefaultLang(Language.English);

        // the lang to use, if the lang isn't available, it will use the current loader to get them
        const selectedLanguage = this.localStorageService.get(StorageKey.Language) || Language.English;
        this.translateService.use(selectedLanguage);
    }

    private initDynamicLayout() {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationStart) {
                this.loaderService.addRequest();
            }

            if (event instanceof NavigationEnd) {
                // reset layout
                this.showHeader = true;
                this.showSidebar = false;
                this.showFooter = false;

                // update values from the route
                const layoutData = getLayoutData(this.activatedRoute.snapshot);
                if (!isNil(layoutData.showHeader)) {
                    this.showHeader = layoutData.showHeader;
                }
                if (!isNil(layoutData.showSidebar)) {
                    this.showSidebar = layoutData.showSidebar;
                }
                if (!isNil(layoutData.showFooter)) {
                    this.showFooter = layoutData.showFooter;
                }

                this.loaderService.removeRequest();
            }

            if (event instanceof NavigationCancel) {
                this.loaderService.removeRequest();
            }
        });
    }
}
