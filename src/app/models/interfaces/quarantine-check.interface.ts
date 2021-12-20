import { GenericCard } from '../types/card.type';

export interface QuarantineCheck {
    trash: GenericCard[];
    table: {[key: number]: GenericCard[]};
}
