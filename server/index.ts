import cors from "cors";
import express from "express";
import * as http from "http";

import { config, isProduction } from "./config";
import { initPeerServer, initTwilio } from "./peer";

(async () => {
    try {
        const app = express();
        app.disable("x-powered-by");

        app.use(
            cors({
                origin: !isProduction ? "localhost" : /.*.?chunkup\.com/,
                credentials: true,
            })
        );

        const server = http.createServer(app);

        app.use("/api/peer", initPeerServer(server));

        app.get("/api/config", async (_, res) => {
            const token = await initTwilio();
            const processedICEServers = token.iceServers.map((server) => {
                const { url, ...processedServer } = server;
                return processedServer;
            });

            res.send({
                peerjs: {
                    iceServers: processedICEServers,
                }
            });
        });

        server.listen(config.server.port, () => {
            console.log(`Gamers API listening on :${config.server.port}`);
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exit(1);
    }
})();
