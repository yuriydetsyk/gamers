export interface WebSocketMessage {
    target?: string;
    type: string;
    sdp?: RTCSessionDescription;
    date?: number;
    data?: string;
    peerId?: string;
    candidate?: RTCIceCandidate;
}
