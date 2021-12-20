// #!/usr/bin/env node
//
// WebSocket chat server
// Implemented using Node.js
//
// Requires the websocket module.
//
// WebSocket and WebRTC based multi-user chat sample with two-way video
// calling, including use of TURN if applicable or necessary.
//
// This file contains the JavaScript code that implements the server-side
// functionality of the chat system, including user ID management, message
// reflection, and routing of private messages, including support for
// sending through unknown JSON objects to support custom apps and signaling
// for WebRTC.
//
// Requires Node.js and the websocket module (WebSocket-Node):
//
//  - http://nodejs.org/
//  - https://github.com/theturtle32/WebSocket-Node
//
// To read about how this sample works:  http://bit.ly/webrtc-from-chat
//
// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as url from 'url';
import {
    server as WebSocketServer,
    request as WebSocketRequest,
    connection as WebSocketConnection
} from 'websocket';
import { WebSocketMessage } from './web-socket-message.interface';

type ExtendedWebSocketMessage = WebSocketConnection & { peerId?: string };

// Pathnames of the SSL key and certificate files to use for
// HTTPS connections.

const keyFilePath = '../certificates/localhost.key';
const certFilePath = '../certificates/localhost.crt';

// Used for managing the text chat user list.

let connectionArray: ExtendedWebSocketMessage[] = [];

// Output logging information to console

function log(text: any) {
    const time = new Date();

    console.log('[' + time.toLocaleTimeString() + '] ' + text);
}

// If you want to implement support for blocking specific origins, this is
// where you do it. Just return false to refuse WebSocket connections given
// the specified origin.
function originIsAllowed(origin: string) {
    log('===originIsAllowed===');
    log(origin);
    return true;    // We will accept all connections
}

// Sends a message (which is already stringified JSON) to a single
// user, given their username. We use this for the WebRTC signaling,
// and we could use it for private text messaging.
function sendToOneUser(target: string, msgString: string) {
    for (const connection of connectionArray) {
        if (connection.peerId === target) {
            connection.sendUTF(msgString);
            break;
        }
    }
}

// Scan the list of connections and return the one for the specified
// peerId. Each login gets an ID that doesn't change during the session,
// so it can be tracked across username changes.
function getConnectionForID(peerId: string) {
    return connectionArray.find(item => item.peerId === peerId) || null;
}

// Builds a message object of type "userlist" which contains the names of
// all connected users. Used to ramp up newly logged-in users and,
// inefficiently, to handle name change notifications.
function makeUserListMessage() {
    const userListMsg: any = {
        type: 'userlist',
        users: []
    };

    // Add the users to the list

    for (const connection of connectionArray) {
        userListMsg.users.push(connection.peerId);
    }

    return userListMsg;
}

// Sends a "userlist" message to all chat members. This is a cheesy way
// to ensure that every join/drop is reflected everywhere. It would be more
// efficient to send simple join/drop messages to each user, but this is
// good enough for this simple example.
function sendUserListToAll() {
    const userListMsg = makeUserListMessage();
    const userListMsgStr = JSON.stringify(userListMsg);

    for (const connection of connectionArray) {
        connection.sendUTF(userListMsgStr);
    }
}


// Try to load the key and certificate files for SSL so we can
// do HTTPS (required for non-local WebRTC).

const httpsOptions: any = {
    key: null,
    cert: null
};

try {
    httpsOptions.key = fs.readFileSync(keyFilePath);
    try {
        httpsOptions.cert = fs.readFileSync(certFilePath);
    } catch (err) {
        httpsOptions.key = null;
        httpsOptions.cert = null;
    }
} catch (err) {
    httpsOptions.key = null;
    httpsOptions.cert = null;
}

// If we were able to get the key and certificate files, try to
// start up an HTTPS server.

let webServer = null;

try {
    if (httpsOptions.key && httpsOptions.cert) {
        webServer = https.createServer(httpsOptions, handleWebRequest);
        log('HTTPS server');
    }
} catch (err) {
    webServer = null;
}

if (!webServer) {
    try {
        webServer = http.createServer({}, handleWebRequest);
        log('HTTP server');
    } catch (err) {
        webServer = null;
        log(`Error attempting to create HTTP(s) server: ${err.toString()}`);
    }
}


// Our HTTPS server does nothing but service WebSocket
// connections, so every request just returns 404. Real Web
// requests are handled by the main server on the box. If you
// want to, you can return real HTML here and serve Web content.

function handleWebRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    log('Received request for ' + request.url);
    response.writeHead(404);
    response.end();
}

// Spin up the HTTPS server on the port assigned to this sample.
// This will be turned into a WebSocket port very shortly.

webServer.listen(9000, () => {
    log('Server is listening on port 9000');
});

// Create the WebSocket server by converting the HTTPS server into one.

const wsServer = new WebSocketServer({
    httpServer: webServer,
    autoAcceptConnections: false
});

if (!wsServer) {
    log('ERROR: Unable to create WbeSocket server!');
}

// Set up a "connect" message handler on our WebSocket server. This is
// called whenever a user connects to the server's port using the
// WebSocket protocol.

wsServer.on('request', (request: WebSocketRequest) => {
    if (!originIsAllowed(request.origin)) {
        request.reject();
        log('Connection from ' + request.origin + ' rejected.');
        return;
    }

    // If the peer ID is missing - reject a connection
    const queryData = url.parse(request.httpRequest.url, true).query;
    if (!queryData.id || Array.isArray(queryData.id)) {
        request.reject();
        log('Connection ' + request.origin + ' rejected. Peer ID invalid.');
        return;
    }

    // Accept the request and get a connection.

    const connection: ExtendedWebSocketMessage = request.accept('json', request.origin);

    // Add the new connection to our list of connections.

    log('Connection accepted from ' + connection.remoteAddress + '.');
    connectionArray.push(connection);

    connection.peerId = queryData.id;

    // Send the new client its token; then send back a "peerId" message to tell us what Peer ID they want to use.

    let msg: WebSocketMessage = {
        type: 'id',
        peerId: connection.peerId
    };
    connection.sendUTF(JSON.stringify(msg));

    // Set up a handler for the "message" event received over WebSocket. This
    // is a message sent by a client, and may be text to share with other
    // users, a private message (text or signaling) for one user, or a command
    // to the server.

    connection.on('message', (message) => {
        if (message.type === 'utf8') {
            log('Received Message: ' + message.utf8Data);

            // Process incoming data.

            let sendToClients = true;
            msg = JSON.parse(message.utf8Data);
            const connect = getConnectionForID(msg.peerId);

            // Take a look at the incoming object and act on it based
            // on its type. Unknown message types are passed through,
            // since they may be used to implement client-side features.
            // Messages with a "target" property are sent only to a user
            // by that name.

            switch (msg.type) {
                // Public, textual message
                case 'message':
                    msg.peerId = connect.peerId;
                    msg.text = msg.text.replace(/(<([^>]+)>)/ig, '');
                    break;

                // Peer ID change
                case 'peer-id':
                    // Set this connection's final username and send out the
                    // updated user list to all users. Yeah, we're sending a full
                    // list instead of just updating. It's horribly inefficient
                    // but this is a demo. Don't do this in a real app.
                    connect.peerId = msg.peerId;
                    sendUserListToAll();
                    sendToClients = false;  // We already sent the proper responses
                    break;
            }

            // Convert the revised message back to JSON and send it out
            // to the specified client or all clients, as appropriate. We
            // pass through any messages not specifically handled
            // in the select block above. This allows the clients to
            // exchange signaling and other control objects unimpeded.

            if (sendToClients) {
                const msgString = JSON.stringify(msg);

                // If the message specifies a target username, only send the
                // message to them. Otherwise, send it to every user.
                if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
                    sendToOneUser(msg.target, msgString);
                } else {
                    for (const conn of connectionArray) {
                        conn.sendUTF(msgString);
                    }
                }
            }
        }
    });

    // Handle the WebSocket "close" event; this means a user has logged off
    // or has been disconnected.
    connection.on('close', (reason, description) => {
        // First, remove the connection from the list of connections.
        connectionArray = connectionArray.filter((el) => {
            return el.connected;
        });

        // Now send the updated user list. Again, please don't do this in a
        // real application. Your users won't like you very much.
        sendUserListToAll();

        // Build and output log output for close information.

        let logMessage = 'Connection closed: ' + connection.remoteAddress + ' (' +
            reason;
        if (description !== null && description.length !== 0) {
            logMessage += ': ' + description;
        }
        logMessage += ')';
        log(logMessage);
    });
});
