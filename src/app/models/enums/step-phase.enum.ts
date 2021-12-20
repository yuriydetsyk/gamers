export enum StepPhase {
    TakeFromDeck = 'TakeFromDeck',
    DropFromHand = 'DropFromHand',
    DropFromTable = 'DropFromTable',
    PlayFromHand = 'PlayFromHand',
    PlayFromTable = 'PlayFromTable',
    DefenceFromHand = 'DefenceFromHand',
    GiveToNextPlayer = 'GiveToNextPlayer',
    GiveToPreviousPlayer = 'GiveToPreviousPlayer',
    GiveToPlayer = 'GiveToPlayer',
    ReturnToPlayer = 'ReturnToPlayer',
    ProcessPanic = 'ProcessPanic',
    ProcessEvent = 'ProcessEvent',
    FulfillHandFromDeck = 'FulfillHandFromDeck',
    GiveToSpecificPlayer = 'GiveToSpecificPlayer',
    ShowFromHand = 'ShowFromHand',
    AcceptRequest = 'AcceptRequest',
    PickFromHand = 'PickFromHand',
    RefillDeck = 'RefillDeck'
}

export type TakeStepPhase = StepPhase.TakeFromDeck | StepPhase.FulfillHandFromDeck | StepPhase.PickFromHand;
