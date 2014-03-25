var ThingAPI = require('./thing-client')
  ;

/*
   get a copy of server.crt from your steward, it's the file

       steward/steward/sandbox/server.crt

   also known as

       http://steward.local/server.crt
 */


new ThingAPI.ThingAPI(
{ steward : { crtPath   : 'server.crt' }
, pairing : { thingUUID : 'testing0'
            }
, state   : null
}).on('ready', function(state) {
  console.log('ready state='+ JSON.stringify(state));

// when you get the value of state, then put it above and comment out 'pairing'
}).on('message', function(message) {
  console.log(require('util').inspect(message, { depth: null }));
}).on('close', function() {
  console.log('close');
  process.exit(0);
}).on('error', function(err) {
  console.log('error: ' + err.message);
  process.exit(0);
});
