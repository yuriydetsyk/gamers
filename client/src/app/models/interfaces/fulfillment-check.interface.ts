import { StepPhase } from '../enums/step-phase.enum';

export interface FulfillmentCheck {
    nextStepPhases: StepPhase[];
    nextPlayerId: number;
}
