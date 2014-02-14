var ThingAPI = require('./thing-client')
  ;

new ThingAPI.ThingAPI(
{ steward : { crtPath   : 'server.crt' }
, pairing : { thingUUID : 'dummy' + Math.round((Math.random() * (10000000 - 10) + 10) * 1000)
            }
, state   : { params    : { algorithm : "sha1"
                          , length    : 40
                          , name      : "dummy3@arden-arcade"
                          , issuer    : "arden-arcade"
                          , step      : 30
                          , base32    : "IRNFQOKIK4YUKRKFIJIXENBUHBCVA43OIVZTKYSNKFITA5C2KBUDCUDSJFCDMRRT"
                          , protocol  : "totp"
                          }
            , thingID   : "12"
            }
}).on('ready', function(state) {
  console.log('ready state='+ JSON.stringify(state));

}).on('close', function() {
  console.log('close');
  process.exit(0);
}).on('error', function(err) {
  console.log('error: ' + err.message);
  process.exit(0);
});
