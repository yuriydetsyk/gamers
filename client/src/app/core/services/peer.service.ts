import { Injectable, OnDestroy } from "@angular/core";
import Peer, { MediaConnection } from "peerjs";
import {
    BehaviorSubject,
    interval,
    Observable,
    Observer,
    of,
    Subject,
    throwError,
    zip,
} from "rxjs";
import {
    catchError,
    finalize,
    map,
    switchMap,
    take,
    takeUntil,
    tap,
} from "rxjs/operators";

import { environment } from "../../../environments/environment";
import { PlayerDto } from "../../models/dtos/player-dto.model";
import { Game } from "../../models/enums/game.enum";
import { Config } from '../../models/interfaces/config';
import { PeerData } from "../../models/peer-data.model";
import { PeerStream } from "../../models/peer-stream.model";
import { isNil } from "../helpers/type.helpers";
import { FirebaseService } from "./firebase.service";
import { GameService } from "./game.service";
import { HttpService } from "./http.service";
import { MediaService } from "./media.service";
import { RoomService } from "./room.service";
import { UserService } from "./user.service";

@Injectable({
    providedIn: "root",
})
export class PeerService implements OnDestroy {
    public get userMedia$() {
        return this.mediaService.getUserMedia();
    }
    private peerData: PeerData[] = [];
    private isInitializingPeer = false;
    private initializedPeer$: Subject<Peer>;
    private destroy$ = new Subject<void>();
    private reconnectInterval = 10000;
    private processStreamInterval = 2000;
    private config$ = new BehaviorSubject<Config | null>(null);

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly mediaService: MediaService,
        private readonly userService: UserService,
        private readonly roomService: RoomService,
        private readonly gameService: GameService,
        private readonly httpService: HttpService
    ) {
        interval(this.processStreamInterval)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                // Process already existing active streams
                this.processActiveStreams();
            });

        interval(this.reconnectInterval)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                // If needed - reconnect to improperly processed peers
                this.reconnectIfNeeded();
            });
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public createOrRestorePeer(forceReload = false) {
        const player = this.gameService.getActivePlayer();
        if (!player) {
            return of<Peer>(null);
        }

        if (!forceReload && this.isInitializingPeer) {
            return this.initializedPeer$.asObservable().pipe(take(1));
        }

        const peerData = this.getOrAddPeerData();
        if (!forceReload && peerData.currentPeer) {
            return of(peerData.currentPeer);
        }

        return this.initPeer();
    }

    public destroyPeer(game: Game): Observable<any> {
        const roomId = this.roomService.getSelectedRoomId(game);
        const userId = this.userService.getCurrentUserId();
        if (!roomId || !userId) {
            console.warn("Room ID or User ID not specified");
            return of(true);
        }

        return this.clearPeerId(roomId, userId).pipe(
            // Reset local peer data
            map(() => this.clearPeerData(game))
        );
    }

    private initPeer() {
        const roomId = this.roomService.getSelectedRoomId();
        if (isNil(roomId)) {
            throw new Error("Game or Room ID is missing");
        }

        return this.getPeerServersConfig().pipe(
            switchMap((peerServersConfig) => {
                return new Observable((observer: Observer<Peer>) => {
                    this.isInitializingPeer = true;

                    if (this.initializedPeer$) {
                        this.initializedPeer$.complete();
                    }
                    this.initializedPeer$ = new Subject<Peer>();

                    const peer = new Peer(
                        this.firebaseService.generateId(),
                        peerServersConfig,
                    );

                    peer.on("open", (id) => {
                        console.log(`--Peer has been opened: ${id}--`);

                        const userId = this.userService.getCurrentUserId();

                        return zip(
                            this.setPeerId(roomId, userId, id),
                            this.userMedia$
                        )
                            .pipe(
                                take(1),
                                tap(([_, userMedia]) => {
                                    peer.on("call", (call) =>
                                        this.initIncomingCall(call, userMedia)
                                    );
                                }),
                                switchMap(() => {
                                    return this.firebaseService.getQuery(
                                        PlayerDto,
                                        "players",
                                        [
                                            {
                                                field: "roomId",
                                                operator: "==",
                                                value: roomId,
                                            },
                                        ]
                                    );
                                }),
                                switchMap((players) =>
                                    this.processPeers(
                                        Game.Nechto,
                                        players,
                                        true
                                    )
                                ),
                                map(() => {
                                    observer.next(peer);
                                    this.initializedPeer$.next(peer);
                                }),
                                finalize(() => {
                                    this.isInitializingPeer = false;
                                    return observer.complete();
                                }),
                                catchError((error) => {
                                    observer.error(error);
                                    return throwError(error);
                                })
                            )
                            .subscribe();
                    });

                    peer.on("close", () => {
                        console.log(`--Peer has been closed--`);
                    });

                    peer.on("disconnected", () => {
                        console.log(`--Peer has been disconnected--`);
                    });

                    peer.on("error", (err) => {
                        console.log(`--Peer error--`);
                        console.log(err);
                    });

                    const peerData = this.getOrAddPeerData();
                    peerData.currentPeer = peer;
                });
            })
        );
    }

    public setPeerId(roomId: string, userId: string, peerId: string) {
        return this.firebaseService
            .get(PlayerDto, "players", `${roomId}_${userId}`)
            .pipe(
                switchMap((player) => {
                    if (player) {
                        return this.firebaseService.update(
                            PlayerDto,
                            "players",
                            `${roomId}_${userId}`,
                            { peerId }
                        );
                    } else {
                        return of(null as PlayerDto);
                    }
                })
            );
    }

    public clearPeerData(game: Game) {
        if (isNil(game)) {
            return;
        }

        const peerData = this.getOrAddPeerData();
        if (
            peerData &&
            peerData.currentPeer &&
            !peerData.currentPeer.destroyed
        ) {
            peerData.currentPeer.destroy();
        }

        this.peerData = this.peerData.filter((item) => item.game !== game);
    }

    public processActiveStreams() {
        const peerData = this.getOrAddPeerData();

        if (!peerData.activeStreams) {
            return;
        }

        const playerComponents = this.gameService.getPlayerComponents();

        // No active streams left - remove all peer / stream data
        if (!peerData.activeStreams.length) {
            // All players left the room
            const otherStreamingPlayers = this.gameService
                .getStreamingPlayerComponents()
                .filter(
                    (item) =>
                        item.playerId !== this.gameService.getActivePlayerId()
                );

            if (otherStreamingPlayers.length) {
                console.log(
                    ">>> - Removing all active streams (all players left the room except current player)"
                );
                otherStreamingPlayers.forEach((item) => {
                    item.peerId = null;

                    if (item.hasStream) {
                        item.playerStream = null;
                    }
                });

                this.gameService.playerStreamsUpdated$.next();
            }

            return;
        }

        playerComponents.forEach((playerComponent) => {
            if (playerComponent.peerId) {
                // Player has a peer instance
                const activeStream = peerData.activeStreams.find(
                    (item) => item.peerId === playerComponent.peerId
                );
                if (
                    activeStream &&
                    (!playerComponent.hasStream ||
                        playerComponent.playerStream.id !==
                            activeStream.stream.id)
                ) {
                    console.log(
                        `>>> + Enabling an active stream for player #${playerComponent.playerId}`
                    );
                    playerComponent.playerStream = activeStream.stream;
                }
            } else if (playerComponent.hasStream) {
                // Player is not streaming anymore
                console.log(
                    `>>> - Disabling an active stream for player #${playerComponent.playerId}`
                );
                playerComponent.playerStream = null;
            }
        });
    }

    private getOrAddPeerData() {
        const game = this.gameService.getSelectedGame();
        if (isNil(game)) {
            return;
        }

        const peerData = this.peerData.find((item) => item.game === game);
        if (peerData) {
            return peerData;
        } else {
            this.peerData.push(new PeerData({ game }));
            return this.peerData.find((item) => item.game === game);
        }
    }

    private clearPeerId(roomId: string, userId: string) {
        return this.setPeerId(roomId, userId, null);
    }

    private processPeers(game: Game, players: PlayerDto[], initCalls = false) {
        return this.userMedia$.pipe(
            take(1),
            map((userMedia) => {
                const peerData = this.getOrAddPeerData();
                if (isNil(game) || isNil(peerData.currentPeer)) {
                    return;
                }

                // Remove current player from the list.
                players = players.filter(
                    (player) => player.peerId !== peerData.currentPeer.id
                );

                const peerIds = players.map((player) => player.peerId);

                // If we have any new players, initiate connection to them
                if (initCalls && players.length) {
                    // Add new peers and create calls
                    const newCallPlayers = peerIds.map((peerId) =>
                        players.find((player) => player.peerId === peerId)
                    );

                    newCallPlayers.forEach((player) => {
                        this.initOutgoingCall(
                            peerData.currentPeer,
                            player.peerId,
                            userMedia
                        );
                    });
                }

                return peerData;
            })
        );
    }

    private initIncomingCall(call: MediaConnection, userMedia: MediaStream) {
        if (!call) {
            return;
        }

        // Answer the call with an A/V stream.
        call.answer(userMedia);
        console.log(`---Call (incoming, peer ${call.peer}) init---`);

        return this.initCallListeners(call);
    }

    private initOutgoingCall(
        peer: Peer,
        externalPeerId: string,
        userMedia: MediaStream
    ) {
        if (!peer || !externalPeerId) {
            return;
        }

        // Call a peer, providing our mediaStream
        const call = peer.call(externalPeerId, userMedia);
        console.log(`---Call (outgoing, peer ${call.peer}) init---`);

        return this.initCallListeners(call);
    }

    private initCallListeners(call: MediaConnection) {
        call.on("stream", (remoteStream) => {
            console.log(`---Call (peer ${call.peer}) stream---`);

            // Add stream locally so it can be later tracked
            this.addActiveStream(call, remoteStream);
        });
        call.on("close", () => {
            console.log(`---Call (peer ${call.peer}) close---`);

            this.removeActiveStream(call.peer);
        });
        call.on("error", (err) => {
            console.log(`---Call (peer ${call.peer}) error---`);
            console.log(err);

            this.removeActiveStream(call.peer);
        });

        return call;
    }

    private addActiveStream(call: MediaConnection, stream: MediaStream) {
        this.addActiveCall(call);

        const peerData = this.getOrAddPeerData();
        const peerId = call.peer;
        const peerStream = new PeerStream({ peerId, stream });
        peerData.activeStreams = [
            ...peerData.activeStreams.filter((item) => item.peerId !== peerId),
            peerStream,
        ];
        console.log(`>>> + Adding an active stream for peer #${peerId}`);
    }

    private addActiveCall(call: MediaConnection) {
        const peerData = this.getOrAddPeerData();
        const peerId = call.peer;
        peerData.activeCalls = [
            ...peerData.activeCalls.filter((item) => item.peer !== peerId),
            call,
        ];
        console.log(`>>> + Adding an active call for peer #${peerId}`);
    }

    private removeActiveStream(peerId: string) {
        this.removeActiveCall(peerId);

        const peerData = this.getOrAddPeerData();
        peerData.activeStreams = peerData.activeStreams.filter(
            (item) => item.peerId !== peerId
        );

        console.log(`>>> - Removing an active stream for peer #${peerId}`);
    }

    private removeActiveCall(peerId: string) {
        const peerData = this.getOrAddPeerData();
        let call: MediaConnection;

        peerData.activeCalls = [
            ...peerData.activeCalls.filter((item) => {
                if (item.peer !== peerId) {
                    return true;
                } else {
                    call = item;
                    return false;
                }
            }),
        ];

        if (call && call.open) {
            call.close();
        }

        console.log(`>>> - Removing an active call for peer #${peerId}`);
    }

    private reconnectIfNeeded() {
        const peerData = this.getOrAddPeerData();
        if (!peerData.currentPeer) {
            return;
        }

        const activePlayers =
            this.gameService.getActivePlayerComponents(true).length;
        const activeStreamers =
            this.gameService.getStreamingPlayerComponents().length;
        if (activePlayers === activeStreamers) {
            // We don't need to reconnect to any of connected peers
            return;
        }

        const reconnectToStreamers = this.gameService
            .getInvalidStreamingPlayerComponents()
            .filter((item) => !!item.peerId);
        if (!reconnectToStreamers.length) {
            return;
        }

        console.log(
            "Different amount of activePlayers VS activeStreamers. Reconnecting..."
        );
        console.log(`activePlayers = ${activePlayers}`);
        console.log(`activeStreamers = ${activeStreamers}`);

        this.userMedia$
            .pipe(
                map((userMedia) => {
                    reconnectToStreamers.forEach((player) => {
                        if (player.peerId) {
                            this.removeActiveCall(player.peerId);
                            this.initOutgoingCall(
                                peerData.currentPeer,
                                player.peerId,
                                userMedia
                            );
                            console.log(
                                `>>> - Reconnecting to peer #${player.peerId}`
                            );
                        }
                    });
                })
            )
            .subscribe();
    }

    private getConfig() {
        if (this.config$.value) {
            return of(this.config$.value);
        }

        return this.httpService.get<Config>(`${environment.api.url}/api/config`).pipe(
            tap((config) => this.config$.next(config))
        );
    }

    private getPeerServersConfig() {
        return this.getConfig().pipe(
            map((config) => {
                return {
                    host: environment.domain,
                    port: environment.api.port,
                    path: "/api/peer/live",
                    config: {
                        iceServers: config.peerjs.iceServers
                    },
                };
            })
        );
    }
}
