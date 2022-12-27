import cors from "cors";
import express from "express";
import * as http from "http";

import { config } from "./config";
import { initPeerServer, initTwilio } from "./peer";

(async () => {
    try {
        const app = express();
        app.disable("x-powered-by");

        app.use(
            cors({
                origin:
                    config.server.env === "local"
                        ? "localhost"
                        : /.*.?(gamers\.org\.ua)/,
                credentials: true,
            })
        );

        const server = http.createServer(app);

        await initTwilio();

        app.use("/api/peer", initPeerServer(server));

        app.get("/api/config", (_, res) =>
            res.send({
                peerjs: config.peerjs,
            })
        );

        server.listen(config.server.port, () => {
            console.log(`Gamers API listening on :${config.server.port}`);
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exit(1);
    }
})();
