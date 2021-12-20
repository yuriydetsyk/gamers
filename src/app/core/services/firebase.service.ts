import 'firebase/firestore';
import 'firebase/storage';

import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore, CollectionReference, Query, QueryFn } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
import { auth, User } from 'firebase/app';
import { defer, forkJoin, from, Observable, Observer, of, Subject } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';

import { UserDto } from '../../models/dtos/user-dto.model';
import { FirestoreCondition } from '../../models/interfaces/firestore-condition.interface';
import { SignIn } from '../../models/sign-in.model';
import { SignUp } from '../../models/sign-up.model';
import { getRandomItem } from '../helpers/array.helpers';
import { convertToFirebaseObject } from '../helpers/object.helpers';
import { PipeHelpers } from '../helpers/pipe.helpers';

@Injectable({
    providedIn: 'root'
})
export class FirebaseService {
    public firebaseUser: User;
    public session: Subject<void>;
    private authState$: Observable<User>;

    constructor(
        private readonly afAuth: AngularFireAuth,
        private readonly db: AngularFirestore,
        private readonly storage: AngularFireStorage,
        private readonly pipeHelpers: PipeHelpers
    ) {
        this.authState$ = new Observable((observer: Observer<User>) => {
            this.afAuth.onAuthStateChanged(
                (user?: User) => {
                    this.firebaseUser = user;

                    if (user) {
                        if (!this.session) {
                            this.session = new Subject<void>();
                        }
                    } else if (this.session) {
                        this.session.next();
                        this.session.complete();

                        this.session = null;
                    }

                    return observer.next(user);
                },
                (error: auth.Error) => observer.error(error),
                () => observer.complete()
            );
        });
    }

    public signUp(data: SignUp) {
        return from(this.afAuth.createUserWithEmailAndPassword(data.email, data.password))
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap((credential) => defer(
                    async () => {
                        const user = new UserDto({
                            id: credential.user.uid,
                            username: data.email.split('@')[0],
                            gender: data.gender,
                            biography: data.biography
                        });

                        await this.db.collection<UserDto>('users')
                            .doc(credential.user.uid)
                            .set(convertToFirebaseObject(user));

                        return user;
                    }
                )),
                this.pipeHelpers.endRequestPipe
            );
    }

    public signIn(data: SignIn) {
        return from(this.afAuth.setPersistence(auth.Auth.Persistence.LOCAL))
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap(() => {
                    return from(this.afAuth.signInWithEmailAndPassword(data.email, data.password));
                }),
                switchMap((credential) => {
                    return this.getCurrentUser(credential.user.uid);
                }),
                this.pipeHelpers.endRequestPipe
            );
    }

    public signInAnonymously(username: string) {
        return from(this.afAuth.setPersistence(auth.Auth.Persistence.LOCAL))
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap(() => from(this.afAuth.signInAnonymously())),
                switchMap(async (credential) => {
                    const id = `GUEST_${credential.user.uid}`;

                    const user = new UserDto({ id, username });

                    await this.db.collection<UserDto>('users')
                        .doc(id)
                        .set(convertToFirebaseObject(user));

                    return id;
                }),
                switchMap((id) => this.getCurrentUser(id)),
                this.pipeHelpers.endRequestPipe
            );
    }

    public signOut(isGuest: boolean = false) {
        const observable = isGuest ? this.signOutAndDelete() : from(this.afAuth.signOut());
        return observable.pipe(this.pipeHelpers.startRequestPipe, this.pipeHelpers.endRequestPipe);
    }

    public getCurrentUser(userId: string) {
        return this.db.collection<UserDto>('users').doc<UserDto>(userId).get()
            .pipe(
                this.pipeHelpers.startRequestPipe,
                map((document) => new UserDto(document.data())),
                this.pipeHelpers.endRequestPipe
            );
    }

    public getAuthState() {
        return this.authState$;
    }

    public uploadFile(file: File, userId: string) {
        // Create file metadata including the content type
        const metadata = {
            contentType: file.type || 'image/png',
        };

        // Create a file reference
        const fileRef = this.storage.ref(`users/${userId}/${file.name}`);

        // Upload the file and metadata
        return from(fileRef.put(file, metadata).then())
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap(() => fileRef.getDownloadURL()),
                map((url) => url as string),
                this.pipeHelpers.endRequestPipe
            );
    }

    public update<T>(type: new (...args: any[]) => T, path: string, id: string, data: Partial<T>) {
        return from(
            this.db.collection<T>(path)
                .doc<T>(id)
                .update(convertToFirebaseObject(data))
        )
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap(() => this.db.collection<T>(path).doc<T>(id).get()),
                map((document) => new type(document.data())),
                this.pipeHelpers.endRequestPipe
            );
    }

    public updateAll<T>(type: new (...args: any[]) => T, path: string, data: Partial<T>) {
        return this.updateQuery<T>(type, path, null, data);
    }

    public updateQuery<T>(type: new (...args: any[]) => T, path: string, conditions: FirestoreCondition[] = null, data: Partial<T>) {
        const queryFn: QueryFn = (ref: CollectionReference | Query) => {
            if (conditions) {
                conditions.forEach((condition) => {
                    ref = ref.where(condition.field, condition.operator, condition.value);
                });
            }

            return ref;
        };

        return from(this.db.collection<T>(path, queryFn).get())
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap((res) => {
                    const updateResults: Observable<void>[] = [of(null)];
                    res.forEach((doc) => {
                        updateResults.push(
                            from(doc.ref.update(convertToFirebaseObject(data)))
                        );
                    });

                    return forkJoin(updateResults);
                }),
                switchMap(() => this.db.collection<T>(path, queryFn).get()),
                map((res) => {
                    const results: T[] = [];
                    res
                        .forEach((item: any) => {
                            if (item.data) {
                                results.push(new type(item.data()));
                            }
                        });
                    return results;
                }),
                this.pipeHelpers.endRequestPipe
            );
    }

    public set<T>(type: new (...args: any[]) => T, path: string, id: string, data: T | Partial<T>) {
        return from(
            this.db.collection<T>(path)
                .doc<T>(id)
                .set(convertToFirebaseObject(data))
        )
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap(() => this.db.collection<T>(path).doc<T>(id).get()),
                map((document) => new type(document.data())),
                this.pipeHelpers.endRequestPipe
            );
    }

    public get<T>(type: new (...args: any[]) => T, path: string, id: string) {
        return from(this.db.collection<T>(path).doc<T>(id).get())
            .pipe(
                this.pipeHelpers.startRequestPipe,
                map((res) => !!res.data() ? new type(res.data()) : res.data()),
                this.pipeHelpers.endRequestPipe
            );
    }

    public getAll<T>(type: new (...args: any[]) => T, path: string) {
        return this.getQuery<T>(type, path);
    }

    public getQuery<T>(type: new (...args: any[]) => T, path: string, conditions?: FirestoreCondition[]) {
        const queryFn: QueryFn = (ref: CollectionReference | Query) => {
            if (conditions) {
                conditions.forEach((condition) => {
                    ref = ref.where(condition.field, condition.operator, condition.value);
                });
            }

            return ref;
        };

        return from(this.db.collection<T>(path, queryFn).get())
            .pipe(
                this.pipeHelpers.startRequestPipe,
                map((res) => {
                    const results: T[] = [];
                    res.forEach((item: any) => {
                        if (item.data) {
                            results.push(new type(item.data()));
                        }
                    });
                    return results;
                }),
                this.pipeHelpers.endRequestPipe
            );
    }

    public listen<T>(type: new (...args: any[]) => T, path: string) {
        return this.db.collection<T>(path).valueChanges()
            .pipe(
                map((info) => info.map((item) => new type(item))),
                catchError(() => {
                    console.warn(`Listening to ${path} has failed`);
                    return of([] as T[]);
                })
            );
    }

    public delete<T>(type: new (...args: any[]) => T, path: string, id: string) {
        return this.get(type, path, id)
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap((res) => {
                    if (res) {
                        return from(this.db.collection(path).doc(id).delete());
                    } else {
                        return of(null);
                    }
                }),
                this.pipeHelpers.endRequestPipe
            );
    }

    public deleteQuery(path: string, conditions: FirestoreCondition[]): Observable<any> {
        const queryFn: QueryFn = (ref: CollectionReference | Query) => {
            conditions.forEach((condition) => {
                ref = ref.where(condition.field, condition.operator, condition.value);
            });

            return ref;
        };

        return from(this.db.collection(path, queryFn).get())
            .pipe(
                this.pipeHelpers.startRequestPipe,
                switchMap((res) => {
                    const deleteResults: Observable<void>[] = [of(null)];
                    res.forEach((doc) => {
                        deleteResults.push(from(doc.ref.delete()));
                    });

                    return forkJoin(deleteResults);
                }),
                this.pipeHelpers.endRequestPipe
            );
    }

    public generateId(length?: number) {
        return !length ? this.db.createId() : this.db.createId().substr(0, length);
    }

    public generateNumericId() {
        return getRandomItem([...Array(65535).keys()]);
    }

    public getFormattedUserId(user: User) {
        return !user.isAnonymous ? user.uid : `GUEST_${user.uid}`;
    }

    private signOutAndDelete() {
        return this.authState$
            .pipe(
                take(1),
                switchMap((authState) => {
                    const userId = this.getFormattedUserId(authState);
                    return forkJoin([
                        of(authState),
                        this.delete(UserDto, 'users', userId),
                        this.deleteQuery('players', [{
                            field: 'userId',
                            operator: '==',
                            value: userId
                        }]),
                        this.deleteQuery('rooms', [{
                            field: 'authorId',
                            operator: '==',
                            value: userId
                        }])
                    ]);
                }),
                switchMap(([authState]) => from(authState.delete()))
            );
    }
}
