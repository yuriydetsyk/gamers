// #!/usr/bin/env node

import * as fs from 'fs';
import { PeerServer } from 'peer';

// Your Account Sid and Auth Token from twilio.com/console
// DANGER! This is insecure. See http://twil.io/secure
const accountSid = 'AC4f405e6135df310fa224f87406ba3807';
const authToken = '9435c1e77dc99dc579f0c8bc86d1d34d';
const client = require('twilio')(accountSid, authToken);

client.tokens.create().then((token) => {
    console.log(`Twilio username: ${token.username}`);
});

const server = PeerServer({
    port: 9000,
    path: '/peer',
    proxied: true,
    debug: true,
    ssl: {
        key: fs.readFileSync('../certificates/localhost.key'),
        cert: fs.readFileSync('../certificates/localhost.crt')
    }
});

server.on('connection', (id) => console.log(`New Peer Connection: ${id}`));
server.on('disconnect', (id) => console.log(`Peer Disconnected: ${id}`));

console.log('PeerServer has been started');
