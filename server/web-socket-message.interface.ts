export interface WebSocketMessage {
    target?: string;
    type: string;
    sdp?: RTCSessionDescription;
    date?: number;
    text?: string;
    peerId?: string;
    candidate?: RTCIceCandidate;
}
