import { Card } from './card.model';
import { NechtoCardType } from './enums/nechto-card-type.enum';
import { NechtoCardAction } from './enums/nechto-card-action.enum';
import { NechtoCardSubType } from './enums/nechto-card-sub-type.enum';

export class NechtoCard extends Card {
    public type: NechtoCardType = null;
    public subType: NechtoCardSubType = null;
    public action: NechtoCardAction = null;
    public requiredPlayersQty: number = null;

    constructor(data?: Partial<NechtoCard>) {
        super(data);
        Object.assign(this, data);
    }
}
