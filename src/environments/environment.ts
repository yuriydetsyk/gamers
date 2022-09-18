export const environment = {
    production: false,
    firebase: {
        apiKey: 'AIzaSyA2-C-ykhmR1QulgG2RSidsBbqMgW_PjHU',
        authDomain: 'gamers-website.firebaseapp.com',
        databaseURL: 'https://gamers-website.firebaseio.com',
        projectId: 'gamers-website',
        storageBucket: 'gamers-website.appspot.com',
        messagingSenderId: '934983022687',
        appId: '1:934983022687:web:d7e995978057c10bfcc3ea'
    },
    peerjs: {
        host: 'peer.gamers.org.ua',
        port: 443,
        path: '/peer',
        config: {
            iceServers: [{
                url: 'stun:global.stun.twilio.com:3478?transport=udp',
                urls: 'stun:global.stun.twilio.com:3478?transport=udp'
            },
            {
                url: 'turn:global.turn.twilio.com:3478?transport=udp',
                username: '6da13fcac96ea1864377ee0c3cdc038a96397ac8ccebb533e1de55558479ab3b',
                urls: 'turn:global.turn.twilio.com:3478?transport=udp',
                credential: 'Wm0f9CxvFPUrbOhlhX+fS10NLdrpX3x6FqFptmmHf80='
            },
            {
                url: 'turn:global.turn.twilio.com:3478?transport=tcp',
                username: '6da13fcac96ea1864377ee0c3cdc038a96397ac8ccebb533e1de55558479ab3b',
                urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
                credential: 'Wm0f9CxvFPUrbOhlhX+fS10NLdrpX3x6FqFptmmHf80='
            },
            {
                url: 'turn:global.turn.twilio.com:443?transport=tcp',
                username: '6da13fcac96ea1864377ee0c3cdc038a96397ac8ccebb533e1de55558479ab3b',
                urls: 'turn:global.turn.twilio.com:443?transport=tcp',
                credential: 'Wm0f9CxvFPUrbOhlhX+fS10NLdrpX3x6FqFptmmHf80='
            }]
        }
    },
    domain: 'localhost:4300',
    audioPath: '/assets/audio/'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
