import { Injectable } from '@angular/core';

import { GameDto } from '../../models/dtos/game-dto.model';
import { Game } from '../../models/enums/game.enum';
import { NechtoCardAction } from '../../models/enums/nechto-card-action.enum';
import { NechtoCardSubType } from '../../models/enums/nechto-card-sub-type.enum';
import { NechtoCardType } from '../../models/enums/nechto-card-type.enum';
import { NechtoCard } from '../../models/nechto-card.model';
import { GenericCard } from '../../models/types/card.type';
import { NechtoPlayerComponent } from '../../modules/games/modules/nechto/components/nechto-player/nechto-player.component';
import { FirebaseService } from '../services/firebase.service';
import { getRandomItem, shuffleArray } from './array.helpers';
import { randomIntFromArray } from './general.helpers';
import { isNil } from './type.helpers';

@Injectable({
    providedIn: 'root'
})
export class CardHelpers {
    constructor(private readonly firebaseService: FirebaseService) { }

    public initDeck(game: Game, playersQty: number, filterCardsBasedOnQuantity = false) {
        if (isNil(game)) {
            throw new Error('Game missing');
        }

        const deck: GenericCard[] = [];

        switch (game) {
            case Game.Nechto:
            default:
                let subTypes = Object.entries(NechtoCardSubType);
                let actions = Object.entries(NechtoCardAction);

                const counters: { [key in NechtoCardAction]?: number } = {};
                const maxQuantities: { [key in NechtoCardAction]?: number } = {
                    [NechtoCardAction.Event_Action_Flamethrower]: 5,
                    [NechtoCardAction.Event_Action_Persistence]: 5,
                    [NechtoCardAction.Event_Action_Whiskey]: 3,
                    [NechtoCardAction.Event_Action_SwapPlaces]: 5,
                    [NechtoCardAction.Event_Action_RunAway]: 5,
                    [NechtoCardAction.Event_Action_Suspicion]: 8,
                    [NechtoCardAction.Event_Action_Analysis]: 3,
                    [NechtoCardAction.Event_Action_Temptation]: 7,
                    [NechtoCardAction.Event_Action_LookAround]: 2,
                    [NechtoCardAction.Event_Action_Axe]: 2,
                    [NechtoCardAction.Event_Infection_It]: 1,
                    [NechtoCardAction.Event_Infection_Infection1]: 5,
                    [NechtoCardAction.Event_Infection_Infection2]: 5,
                    [NechtoCardAction.Event_Infection_Infection3]: 5,
                    [NechtoCardAction.Event_Infection_Infection4]: 5,
                    [NechtoCardAction.Event_Defence_Fear]: 4,
                    [NechtoCardAction.Event_Defence_GoodHere]: 3,
                    [NechtoCardAction.Event_Defence_NoBarbecue]: 3,
                    [NechtoCardAction.Event_Defence_Miss]: 3,
                    [NechtoCardAction.Event_Defence_NoThanks]: 4,
                    [NechtoCardAction.Event_Obstacle_Quarantine]: 2,
                    [NechtoCardAction.Event_Obstacle_LockedDoor]: 3,
                    [NechtoCardAction.Panic_Friends]: 2,
                    [NechtoCardAction.Panic_OldRopes]: 2,
                    [NechtoCardAction.Panic_BetweenUs]: 2,
                    [NechtoCardAction.Panic_IsItParty]: 2,
                    [NechtoCardAction.Panic_OneTwo]: 2,
                    [NechtoCardAction.Panic_ThreeFour]: 2,
                    [NechtoCardAction.Panic_BlindDate]: 2,
                    [NechtoCardAction.Panic_ChainReaction]: 2,
                    [NechtoCardAction.Panic_Forgetfulness]: 1,
                    [NechtoCardAction.Panic_GoAway]: 1,
                    [NechtoCardAction.Panic_Oops]: 1,
                    [NechtoCardAction.Panic_ConfessionTime]: 1
                };
                const minRequiredPlayers: { [key in NechtoCardAction]?: number } = {
                    [NechtoCardAction.Event_Action_Flamethrower]: 4,
                    [NechtoCardAction.Event_Action_Persistence]: 6,
                    [NechtoCardAction.Event_Action_Whiskey]: 4,
                    [NechtoCardAction.Event_Action_SwapPlaces]: 11,
                    [NechtoCardAction.Event_Action_RunAway]: 11,
                    [NechtoCardAction.Event_Action_Suspicion]: 4,
                    [NechtoCardAction.Event_Action_Analysis]: 5,
                    [NechtoCardAction.Event_Action_Temptation]: 7,
                    [NechtoCardAction.Event_Action_LookAround]: 9,
                    [NechtoCardAction.Event_Action_Axe]: 9,
                    [NechtoCardAction.Event_Infection_It]: 4,
                    [NechtoCardAction.Event_Infection_Infection1]: 4,
                    [NechtoCardAction.Event_Infection_Infection2]: 4,
                    [NechtoCardAction.Event_Infection_Infection3]: 4,
                    [NechtoCardAction.Event_Infection_Infection4]: 4,
                    [NechtoCardAction.Event_Defence_Fear]: 8,
                    [NechtoCardAction.Event_Defence_GoodHere]: 11,
                    [NechtoCardAction.Event_Defence_NoBarbecue]: 6,
                    [NechtoCardAction.Event_Defence_Miss]: 11,
                    [NechtoCardAction.Event_Defence_NoThanks]: 4,
                    [NechtoCardAction.Event_Obstacle_Quarantine]: 5,
                    [NechtoCardAction.Event_Obstacle_LockedDoor]: 4,
                    [NechtoCardAction.Panic_Friends]: 7,
                    [NechtoCardAction.Panic_OldRopes]: 9,
                    [NechtoCardAction.Panic_BetweenUs]: 7,
                    [NechtoCardAction.Panic_IsItParty]: 9,
                    [NechtoCardAction.Panic_OneTwo]: 5,
                    [NechtoCardAction.Panic_ThreeFour]: 9,
                    [NechtoCardAction.Panic_BlindDate]: 9,
                    [NechtoCardAction.Panic_ChainReaction]: 4,
                    [NechtoCardAction.Panic_Forgetfulness]: 4,
                    [NechtoCardAction.Panic_GoAway]: 5,
                    [NechtoCardAction.Panic_Oops]: 10,
                    [NechtoCardAction.Panic_ConfessionTime]: 8
                };

                // Filter out cards for large player quantities
                if (filterCardsBasedOnQuantity) {
                    actions = actions.filter(([_, value]) => minRequiredPlayers[value] <= playersQty);
                }

                // TODO: make conditional adding of 'Nechto' card

                // There can only be one 'Nechto' card in the deck
                actions = actions.filter(([_, value]) => value !== NechtoCardAction.Event_Infection_It);

                // TODO: need to add cards dynamically depending on players quantity
                for (let index = 0; index < 87; index++) {
                    // If there are no available cards left - return
                    if (!subTypes.length) {
                        break;
                    }

                    const subType = getRandomItem(subTypes);
                    const action = getRandomItem(
                        actions
                            .filter(([key, _]) => {
                                return key.split('_')[0].toUpperCase() === NechtoCardType.Event.toUpperCase()
                                    && key.split('_')[1].toUpperCase() === subType[0].toUpperCase();
                            })
                            .map(([_, value]) => value)
                    );

                    deck.push(new NechtoCard({
                        id: this.firebaseService.generateId(),
                        type: NechtoCardType.Event,
                        subType: subType[1],
                        action,
                        hidden: true
                    }));

                    // Check if we still need this action. If not - remove it
                    counters[action] = (counters[action] || 0) + 1;
                    if (counters[action] === maxQuantities[action]) {
                        actions = actions.filter(([_, value]) => value !== action);

                        const hasSubTypeActions = actions
                            .some(([key, _]) => {
                                return key.split('_')[0].toUpperCase() === NechtoCardType.Event.toUpperCase()
                                    && key.split('_')[1].toUpperCase() === subType[0].toUpperCase();
                            });

                        if (!hasSubTypeActions) {
                            subTypes = subTypes.filter(([_, value]) => value !== subType[1]);
                        }
                    }
                }
                for (let index = 0; index < 20; index++) {
                    // If there are no available cards left - return
                    if (!actions.length) {
                        break;
                    }

                    const action = getRandomItem(
                        actions
                            .filter(([key, _]) => {
                                return key.split('_')[0].toUpperCase() === NechtoCardType.Panic.toUpperCase();
                            })
                            .map(([_, value]) => value)
                    );

                    deck.push(new NechtoCard({
                        id: this.firebaseService.generateId(),
                        type: NechtoCardType.Panic,
                        action,
                        hidden: true
                    }));

                    // Check if we still need this action. If not - remove it
                    counters[action] = (counters[action] || 0) + 1;
                    if (counters[action] === maxQuantities[action]) {
                        actions = actions.filter(([_, value]) => value !== action);
                    }
                }

                return shuffleArray(deck);
        }
    }

    public initHands(game: Game, playerComponents: NechtoPlayerComponent[] = []) {
        if (isNil(game)) {
            throw new Error('Game missing');
        }

        return this.initEmptyCardsObject(playerComponents);
    }

    public initAllCards(
        game: Game,
        playerComponents: NechtoPlayerComponent[] = [],
        filterCardsBasedOnQuantity = false
    ): [Partial<GameDto>, string] {
        if (isNil(game)) {
            throw new Error('Game missing');
        }

        let deck = this.initDeck(game, playerComponents.length, filterCardsBasedOnQuantity);
        const separatedCards: GenericCard[] = [];
        // Put all 'Infection' & 'Panic' cards into the separate stack
        deck = deck.filter((card) => {
            const shouldBeSeparated = (card.type === NechtoCardType.Panic || card.subType === NechtoCardSubType.Infection);
            if (shouldBeSeparated) {
                separatedCards.push(card);
            }

            return !shouldBeSeparated;
        });

        // Set initial hand cards for all the players
        const hands = this.initHands(game, playerComponents);

        // TODO: make conditional adding of 'Nechto' card
        const playerIds = playerComponents.map((item) => item.playerId);
        const whoIsLuckyToday = randomIntFromArray(playerIds); // decide who will have a 'Nechto' card

        //  Get the deck and take its N random cards (N = 4 * players) - 1
        playerComponents.forEach((activePlayer) => {
            if (whoIsLuckyToday === activePlayer.playerId) {
                for (let index = 0; index < 3; index++) {
                    hands[activePlayer.playerId].push({ ...deck.shift(), hidden: false });
                }

                const nechtoCard = this.initNewCard(
                    NechtoCardType.Event,
                    NechtoCardAction.Event_Infection_It,
                    NechtoCardSubType.Infection
                );
                nechtoCard.hidden = false;
                hands[activePlayer.playerId].push(nechtoCard);
            } else {
                for (let index = 0; index < 4; index++) {
                    hands[activePlayer.playerId].push({ ...deck.shift(), hidden: false });
                }
            }
        });

        // Shuffle separated cards with the deck into the main stack
        deck = shuffleArray([...deck, ...separatedCards]);

        // Set empty initial table & borders
        const table = this.initEmptyCardsObject(playerComponents);
        const borders = this.initEmptyCardsObject(playerComponents);

        // Process hidden cards
        deck.forEach((item) => item.hidden = true);

        return [
            {
                deck,
                hands,
                table,
                borders
            },
            playerComponents.find((item) => item.playerId === whoIsLuckyToday).user.id
        ];
    }

    public initEmptyCardsObject(playerComponents: NechtoPlayerComponent[] = []): { [key: number]: GenericCard[] } {
        return playerComponents.reduce((o, item) => {
            o[item.playerId] = [];
            return o;
        }, {});
    }

    public initNewCard(type: NechtoCardType, action: NechtoCardAction, subType: NechtoCardSubType = null): GenericCard {
        return new NechtoCard({
            id: this.firebaseService.generateId(),
            type,
            subType,
            action
        });
    }

    public getCardActionKey(action: NechtoCardAction) {
        const actionKey = Object.keys(NechtoCardAction)
            .find((key) => NechtoCardAction[key] === action) || action;

        return actionKey;
    }

    public getCardType(action: NechtoCardAction) {
        if (!action) {
            return null;
        }

        const actionKey = this.getCardActionKey(action);

        return NechtoCardType[actionKey.split('_')[0]] as NechtoCardType;
    }
}
