import { Direction } from '../enums/direction.enum';
import { StepPhase } from '../enums/step-phase.enum';
import { GenericCard } from '../types/card.type';

export class GameDto {
    public roomId: string = null;
    public deck: GenericCard[] = [];
    public trash: GenericCard[] = [];
    public hands: {[key: number]: GenericCard[]} = {};
    public table: {[key: number]: GenericCard[]} = {};
    public borders: {[key: number]: GenericCard[]} = {};
    public currentStepPlayerId: number = null;
    public previousStepPlayerId: number = null;
    public currentStepPhases: StepPhase[] = [];
    public previousStepPhases: StepPhase[] = [];
    public authorId: string = null;
    public direction: Direction = null;
    public lastCard: GenericCard = {} as GenericCard;
    public reservedStepPlayerId: number = null;
    public reservedStepPhases: StepPhase[] = [];

    constructor(data?: Partial<GameDto>) {
        Object.assign(this, data);
    }
}
