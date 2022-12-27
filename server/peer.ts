import { ExpressPeerServer } from "peer";
import * as http from "http";
import { config } from "./config";

export async function initTwilio() {
    const client = require("twilio")(
        config.twilio.accountSid,
        config.twilio.authToken
    );

    const token: { username: string } = await client.tokens.create();
    console.log(`Twilio username: ${token.username}`);
}

export function initPeerServer(server: http.Server) {
    const peerServer = ExpressPeerServer(server, {
        path: "/peer",
        // proxied: true,
    });

    peerServer.on("connection", (id) =>
        console.log(`New Peer Connection: ${id}`)
    );
    peerServer.on("disconnect", (id) =>
        console.log(`Peer Disconnected: ${id}`)
    );

    console.log("PeerServer has been started");

    return peerServer;
}
