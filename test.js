var ThingAPI = require('./thing-client')
  ;

new ThingAPI.ThingAPI(
{ steward : { crtPath   : 'server.crt' }
, pairing : { thingUUID : 'testing0'
            }
, state   : null
}).on('ready', function(state) {
  console.log('ready state='+ JSON.stringify(state));


// when you get the value of state, then put it above and comment out 'pairing'
}).on('close', function() {
  console.log('close');
  process.exit(0);
}).on('error', function(err) {
  console.log('error: ' + err.message);
  process.exit(0);
});
