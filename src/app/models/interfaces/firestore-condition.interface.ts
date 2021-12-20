export interface FirestoreCondition {
    field: string;
    operator: '<' | '<=' | '==' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any';
    value: any;
}
