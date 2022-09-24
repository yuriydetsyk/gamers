import { FirebaseObject } from '../../models/interfaces/firebase-object.interface';

function convertToFirebaseObject(data: any) {
    try {
        return JSON.parse(JSON.stringify(data));
    } catch (e) {
        return data;
    }
}

function convertToFirebaseObjectWithId(data: any) {
    try {
        const id = data.id;
        if (!id) {
            return data;
        }

        const obj = Object.entries(data).filter(([key, _]) => key !== 'id');
        return { id, obj } as FirebaseObject;
    } catch (e) {
        return data;
    }
}

export { convertToFirebaseObject, convertToFirebaseObjectWithId };
