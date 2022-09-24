export interface NavMenuItem {
    items: {
        title: string;
        path: string;
        children?: NavMenuItem[];
    }[];
}
