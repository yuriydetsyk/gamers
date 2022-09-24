import { Injectable, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { html, stripIndents } from 'common-tags';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GameInfoDto } from '../../models/dtos/game-info-dto.model';
import { StepInfoDto } from '../../models/dtos/step-info-dto.model';
import { Direction } from '../../models/enums/direction.enum';
import { Game } from '../../models/enums/game.enum';
import { Language } from '../../models/enums/language.enum';
import { NechtoCardAction } from '../../models/enums/nechto-card-action.enum';
import { NechtoCardType } from '../../models/enums/nechto-card-type.enum';
import { StepPhase } from '../../models/enums/step-phase.enum';
import { UserAction } from '../../models/enums/user-action';
import { UserLevel } from '../../models/enums/user-level.enum';
import { CardHelpers } from '../helpers/card.helpers';
import { pascalCaseToUnderscore } from '../helpers/string.helpers';
import { FirebaseService } from './firebase.service';

@Injectable({
    providedIn: 'root'
})
export class GameInfoService implements OnDestroy {
    public gamesInfo$ = new BehaviorSubject<GameInfoDto[]>([]);
    public stepsInfo$ = new BehaviorSubject<StepInfoDto[]>([]);
    public get gamesInfo() {
        return this.gamesInfo$.value;
    }
    public get stepsInfo() {
        return this.stepsInfo$.value;
    }

    private destroy$ = new Subject<void>();

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly translateService: TranslateService,
        private readonly cardHelpers: CardHelpers
    ) {
        this.firebaseService.listen(GameInfoDto, 'games-info')
            .pipe(takeUntil(this.destroy$))
            .subscribe((info) => this.gamesInfo$.next(info));

        this.firebaseService.listen(StepInfoDto, 'steps-info')
            .pipe(takeUntil(this.destroy$))
            .subscribe((info) => this.stepsInfo$.next(info));
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public getGameInfo(gameId: Game) {
        return this.gamesInfo.find((item) => item.game === gameId) || null;
    }

    public saveStepInfo(roomId: string, stepInfo: StepInfoDto) {
        return this.firebaseService.set(StepInfoDto, 'steps-info', roomId, stepInfo);
    }

    public getStepInfo(roomId: string) {
        return this.stepsInfo.find((item) => item.roomId === roomId);
    }

    public deleteStepInfo(roomId: string) {
        return this.firebaseService.delete(StepInfoDto, 'steps-info', roomId);
    }

    public getFormattedStepInfo(stepInfo: StepInfoDto) {
        let cardActionKey: string;
        let cardAction: string;
        let cardType: NechtoCardType;
        let cardTypePhrase: string;

        if (stepInfo.cardAction) {
            cardActionKey = this.cardHelpers.getCardActionKey(stepInfo.cardAction);
            cardAction = this.translateService.instant(`i18n.CARDS.ACTIONS.${cardActionKey.toUpperCase()}`);
            cardType = this.cardHelpers.getCardType(stepInfo.cardAction);
            cardTypePhrase =
                (this.translateService.instant(`i18n.CARDS.PHRASES.${cardType.toUpperCase()}_CARD_FORM2`) as string).toLowerCase();
        }

        let formattedDate = '';
        if (stepInfo.processedAt) {
            const hours = stepInfo.processedAt.getHours();
            const minutes = `${stepInfo.processedAt.getMinutes() < 10 ? '0' : ''}${stepInfo.processedAt.getMinutes()}`;
            formattedDate = `[${hours}:${minutes}]`;
        }

        let logString = `<p class="m-0 text-left">
            ${formattedDate} ${this.translateService.instant('i18n.COMMON.PLAYER')} <b>${stepInfo.activeUsername}</b>:
        `;

        switch (stepInfo.stepPhase) {
            case StepPhase.TakeFromDeck:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.TOOK_CARD',
                    { cardTypePhrase }
                ));
                break;

            case StepPhase.FulfillHandFromDeck:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.TOOK_EXTRA_CARD',
                    { cardTypePhrase }
                ));
                break;

            case StepPhase.DefenceFromHand:
                if (stepInfo.otherUsername) {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.DEFENCED_FROM_HAND_FROM',
                        { username: stepInfo.otherUsername, cardAction }
                    ));
                } else {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.DEFENCED_FROM_HAND',
                        { cardAction }
                    ));
                }
                break;

            case StepPhase.PlayFromHand:
                if (stepInfo.otherUsername) {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.PLAYED_FROM_HAND_AGAINST',
                        { username: stepInfo.otherUsername, cardAction }
                    ));
                } else {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.PLAYED_FROM_HAND',
                        { cardAction }
                    ));
                }
                break;

            case StepPhase.PlayFromTable:
                if (stepInfo.otherUsername) {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.PLAYED_FROM_TABLE_AGAINST',
                        { username: stepInfo.otherUsername, cardAction }
                    ));
                } else {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.PLAYED_FROM_TABLE',
                        { cardAction }
                    ));
                }
                break;

            case StepPhase.DropFromTable:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.DROPPED_FROM_TABLE',
                    { cardAction }
                ));
                break;

            case StepPhase.DropFromHand:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.DROPPED_FROM_HAND',
                    { cardTypePhrase }
                ));
                break;

            case StepPhase.GiveToPlayer:
            case StepPhase.GiveToPreviousPlayer:
                if (stepInfo.otherUsername) {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.GAVE_FROM_HAND_TO',
                        { username: stepInfo.otherUsername, cardTypePhrase }
                    ));
                } else {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.GAVE_FROM_HAND',
                        { cardTypePhrase }
                    ));
                }
                break;

            case StepPhase.ReturnToPlayer:
                if (stepInfo.otherUsername) {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.RETURNED_CARD_TO',
                        { username: stepInfo.otherUsername, cardTypePhrase }
                    ));
                } else {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.RETURNED_CARD',
                        { cardTypePhrase }
                    ));
                }
                break;

            case StepPhase.ShowFromHand:
                let details = '';

                if (stepInfo.skipShowing) {
                    details = this.translateService.instant('i18n.STEP_INFO_MESSAGES.SKIPPED_SHOWING');
                } else {
                    if (stepInfo.showAll) {
                        details = this.translateService.instant('i18n.STEP_INFO_MESSAGES.SHOWED_ALL');
                    } else {
                        details = this.translateService.instant('i18n.STEP_INFO_MESSAGES.SHOWED_INFECTION');
                    }
                }

                logString = logString.concat(details);
                break;

            case StepPhase.AcceptRequest:
                if (stepInfo.otherUsername) {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.ACCEPTED_FROM',
                        { username: stepInfo.otherUsername }
                    ));
                } else {
                    logString = logString.concat(this.translateService.instant(
                        'i18n.STEP_INFO_MESSAGES.ACCEPTED'
                    ));
                }
                break;

            case StepPhase.PickFromHand:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.PICKED_CARD',
                    { cardTypePhrase }
                ));
                break;

            case StepPhase.RefillDeck:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.REFILLED_DECK'
                ));
                break;

            default:
                logString = logString.concat(this.translateService.instant(
                    'i18n.STEP_INFO_MESSAGES.APPLIED_UNKNOWN_ACTION'
                ));
                break;
        }

        logString = logString.concat('</p>');

        return html(stripIndents(logString));
    }

    public getFormattedGameDirection(direction: Direction): string {
        if (direction === Direction.Clockwise) {
            return this.translateService.instant('i18n.COMMON.CLOCKWISE');
        } else {
            return this.translateService.instant('i18n.COMMON.COUNTER_CLOCKWISE');
        }
    }

    public getFormattedStepPhase(stepPhase: StepPhase): string {
        const key = pascalCaseToUnderscore(stepPhase);
        return this.translateService.instant(`i18n.STEP_PHASES.${key.toUpperCase()}`);
    }

    public getFormattedUserLevel(level: UserLevel): string {
        const key = pascalCaseToUnderscore(UserLevel[level]);
        return this.translateService.instant(`i18n.USER_LEVELS.${key.toUpperCase()}`);
    }

    public getFormattedLanguage(language: Language): string {
        const key = Object.keys(Language).find((item) => Language[item] === language);
        return this.translateService.instant(`i18n.LANGUAGES.${key.toUpperCase()}`);
    }

    public getFormattedAction(action: NechtoCardAction): string {
        const cardActionKey = this.cardHelpers.getCardActionKey(action);
        return this.translateService.instant(`i18n.CARDS.ACTIONS.${cardActionKey.toUpperCase()}`);
    }

    public getFormattedUserAction(action: UserAction): string {
        const key = pascalCaseToUnderscore(UserAction[action]);
        return this.translateService.instant(`i18n.CARDS.USER_ACTIONS.${key.toUpperCase()}`);
    }
}
