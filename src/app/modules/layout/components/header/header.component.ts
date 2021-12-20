import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import { UserService } from '../../../../core/services/user.service';
import { UserDto } from '../../../../models/dtos/user-dto.model';
import { Game } from '../../../../models/enums/game.enum';
import { MenuItem } from '../../../../models/enums/menu-item.enum';
import { RatingService } from '../../../../core/services/rating.service';
import { UserLevel } from '../../../../models/enums/user-level.enum';
import { Language } from '../../../../models/enums/language.enum';
import { StorageKey } from '../../../../models/enums/storage-key.enum';
import { LocalStorageService } from '../../../../core/services/local-storage.service';
import { TranslateService } from '@ngx-translate/core';
import { GameInfoService } from '../../../../core/services/game-info.service';
import { AudioHelpers } from '../../../../core/helpers/audio.helpers';

@Component({
    selector: 'gw-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
    public websiteTitle = 'Gamers.Org.Ua';
    public openedMenuItem: MenuItem;
    public MenuItem = MenuItem;
    public Game = Game;
    public user: UserDto;
    public UserLevel = UserLevel;
    public Language = Language;
    public get isLogged() {
        return this.tokenService.isLogged;
    }
    public get isGuest() {
        return this.tokenService.isGuest;
    }
    public get selectedLanguage(): Language {
        return this.localStorageService.get(StorageKey.Language) as Language || Language.English;
    }
    public get availableLanguages(): Language[] {
        return Object.values(Language);
    }
    public get hasAudioEffects() {
        return !!this.audioHelpers.hasAudioEffects;
    }

    private subscription = new Subscription();

    constructor(
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly ratingService: RatingService,
        private readonly localStorageService: LocalStorageService,
        private readonly translateService: TranslateService,
        private readonly gameInfoService: GameInfoService,
        private readonly audioHelpers: AudioHelpers
    ) { }

    public ngOnInit() {
        this.subscription.add(
            this.userService.user$.subscribe((user) => {
                this.user = user;
            })
        );
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public signOut() {
        this.tokenService.signOut().subscribe();
    }

    public toggleMenuItem(menuItem: MenuItem, isEnabled = true) {
        if (isEnabled) {
            this.openedMenuItem = menuItem;
        } else {
            this.openedMenuItem = null;
        }
    }

    public isMenuItemActive(menuItem: MenuItem) {
        return this.openedMenuItem === menuItem;
    }

    public getUserLevel() {
        if (this.user) {
            return this.ratingService.getLevel(this.user.id);
        } else {
            return null;
        }
    }

    public setLanguage(language: Language) {
        this.localStorageService.set(StorageKey.Language, language);
        this.translateService.use(language);
    }

    public getFormattedUserLevel() {
        return this.gameInfoService.getFormattedUserLevel(this.getUserLevel());
    }

    public getFormattedLanguage(language: Language) {
        return this.gameInfoService.getFormattedLanguage(language);
    }

    public getFormattedLanguageUrl(language: Language) {
        return `./assets/images/flag-${language}.png`;
    }

    public toggleAudioEffects() {
        this.audioHelpers.toggleAudioEffects(!this.hasAudioEffects);
    }
}
