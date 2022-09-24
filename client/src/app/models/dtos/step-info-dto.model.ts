import { GenericCardAction } from '../types/card-action.type';
import { StepPhase } from '../enums/step-phase.enum';

export class StepInfoDto {
    public roomId: string = null;
    public activeUsername: string = null;
    public otherUsername: string = null;
    public cardAction: GenericCardAction = null;
    public stepPhase: StepPhase = null;
    public skipShowing: boolean = null;
    public showAll: boolean = null;
    public processedAt: Date = null;

    constructor(data?: Partial<StepInfoDto>) {
        Object.assign(this, data, {
            processedAt: data.processedAt && new Date(data.processedAt)
        });
    }
}
