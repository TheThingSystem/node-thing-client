var ThingAPI = require('./thing-client')
  ;

/*
   get a copy of server.crt from your steward, it's the file

       steward/steward/sandbox/server.crt

   also known as

       http://steward.local/server.crt
 */


var deviceType = '/device/sensor/macguffin/sound';

var protothing = {};
    protothing[deviceType] = 
{ device                         :
  { name                         : 'All-Ears Noise Detector'
  , maker                        : 'Macguffin Industries, Ltd.'
  }
, observe                        : [ 'motion' ]
, perform                        : [ 'speak'  ]
, name                           : true
, status                         : [ 'quiet', 'noisy' ]
, properties                     :
  {
    noise                        : 'db'
  , threshold                    : 'db'
  }
, validate                       : 
  { observe                      : true
  , perform                      : true
  }
};


// the udn must be both globally-unique and specific to the thing being registered.
//   cf., https://github.com/TheThingSystem/steward/wiki/Simple-Thing-Protocol#define-instances
// since this is a test file, we are going to use a static value, when you write your code, you MUST use something meaningfully
// related to the thing in question...

var udn = '5eb160e4-e770-4e97-b8ef-dd89aa0a80ed';

var instathing = {};
    instathing.t1 =
{ devicetype                     : deviceType
, name                           : 'Living Room noise sensor'
, status                         : 'quiet'
, device                         :
  { name                         : protothing[deviceType].device.name
  , maker                        : protothing[deviceType].device.maker
/*
  , model                        :
    { name                       : '...'
    , descr                      : '...'
    , number                     : '...'
    }
 */
  , unit                         :
    { serial                     : '...'
    , udn                        : udn
    }
  }
, updated                        : new Date().getTime()
, info                           :
  { noise                        : 20
  , threshold                    : 35
  }
};


new ThingAPI.ThingAPI(
{ steward : { crtPath   : 'server.crt' }
, pairing : { thingUUID : 'testing1'
            }
, state   : null
}).on('paired', function(state) {
  console.log('paired state='+ JSON.stringify(state));

// when you get the value of state, then put it above and comment out 'pairing'
}).on('ready', function() {
  var self = this;

  self.prototype(protothing, function(message) {
    if ((!message.things) || (!message.things[deviceType])) {
      console.log('definition: invalid response');
      process.exit(1);
    }
    if (!message.things[deviceType].success) {
      console.log('definition: ' + JSON.stringify(message.things[deviceType]));
      process.exit(1);
    }

    self.register(instathing, function(message) {
      console.log(require('util').inspect(message, { depth: null }));

      if ((!message.things) || (!message.things.t1)) {
        console.log('registration: invalid response');
        process.exit(1);
      }
      if (!message.things.t1.success) {
        console.log('registration: ' + JSON.stringify(message.things.t1));
        process.exit(1);
      }

      getToWork(self, message.things.t1.thingID);
    });
  });
}).on('message', function(message) {
  console.log(require('util').inspect(message, { depth: null }));
}).on('close', function() {
  console.log('close');

// lost connection, should re-establish it...
  process.exit(0);
}).on('error', function(err) {
  console.log('error: ' + err.message);

// something is seriously wrong, not sure how to recover...
  process.exit(0);
});


var noise     = instathing.t1.info.noise;
var threshold = instathing.t1.info.threshold;
var observe   = {};

var getToWork = function(thing, thingID) {
  var state;

  console.log('>>> getToWork: thingID='+ thingID);


// heartbeat
  setInterval(function() {
    var status = {};

    status[thingID] = { updated: new Date().getTime() };
    thing.update(status);
  }, 50 * 1000);


// determine noise level (randomly)
  state = 'quiet';
  setInterval(function() {
    var didP
      , eventID
      , events
      , status = {};

         if (noise < 30) noise = 30 + Math.round(Math.random() * 10);
    else if (noise > 70) noise = 70 - Math.round(Math.random() * 10);
    else                 noise += Math.round(Math.random() * 20) - 10;

    if (state === 'quiet') {
      if (noise <= threshold) return;
      state = 'noisy';
    } else {
      if (noise >= threshold) return;
      state = 'quiet';
    }

    status[thingID] = { status: state, updated: new Date().getTime(), info: { noise: noise, threshold: threshold } };
    thing.update(status);  

    didP = false;
    events = {};
    for (eventID in observe) if (observe.hasOwnProperty(eventID)) {
      didP = true;
      events[eventID] = { reason: 'observe' };
    }
    if (!didP) return;

    thing.report(events, function(message) {
      var eventID;

      if (!message.events) return;
      for (eventID in message.events) if (message.events.hasOwnProperty(eventID)) {
        if (message.events[eventID].status === 'success') delete(observe[eventID]);
      }      
    });
  }, 30 * 1000);


  thing.on('message', function(message) {
    var f = { '/api/v1/thing/observe':
                function() {
                  var event, eventID, response;

                  response = { path: '/api/v1/thing/report', requestID: message.requestID, events: {} };

                  for (eventID in message.events) if (message.events.hasOwnProperty(eventID)) {
                    event = message.events[eventID];

                    if (event.observe !== 'motion') {
                      response.events[eventID] = { error: { permanent: true, diagnostic: 'invalid observe value' }};
                      continue;
                    }
                    if (!event.testOnly) observe[eventID] = event;
                    response.events[eventID] = { success: true };
                  }

                  thing.reply(response);
                }

            , '/api/v1/thing/report':
                function() {
                  var event, eventID, response;

                  response = { path: '/api/v1/thing/report', requestID: message.requestID, events: {} };

                  for (eventID in message.events) if (message.events.hasOwnProperty(eventID)) {
                    event = message.events[eventID];

                    if (event.reason !== 'cancel') {
                      response.events[eventID] = { error: { permanent: true, diagnostic: 'invalid reason' }};
                      continue;
                    }
                    if (!!observe[eventID]) {
                      response.events[eventID] = { error: { permanent: true, diagnostic: 'invalid eventID' }};
                      continue;
                    }
                    delete(observe[eventID]);
                    response.events[eventID] = { success: true };
                  }

                  thing.reply(response);
                }

            , '/api/v1/thing/perform':
                function() {
                  var task, taskID, response;

                  response = { path: '/api/v1/thing/report', requestID: message.requestID, tasks: {} };

                  for (taskID in message.tasks) if (message.tasks.hasOwnProperty(taskID)) {
                    task = message.tasks[taskID];

                    if (task.perform !== 'speak') {
                      response.tasks[taskID] = { error: { permanent: true, diagnostic: 'invalid perform value' }};
                      continue;
                    }
                    if ((!task.parameter) || (typeof task.parameter !== 'string') || (task.parameter.length === 0)) {
                      response.tasks[taskID] = { error: { permanent: true, diagnostic: 'invalid parameter value' }};
                      continue;
                    }
                    if (task.testOnly) {
                      response.tasks[taskID] = { success: true };
                      continue;
                    }

                    console.log('>>> speaking: ' + task.parameter);
                  }

                  thing.reply(response);
                }
            }[message.path];
    if (!!f) return f();

    console.log('invalid message: ' + JSON.stringify(message));
  });
};
