export interface Config {
    peerjs: {
        iceServers: {
            url: string;
            urls: string;
            username?: string;
            credential?: string;
        }[];
    };
}
