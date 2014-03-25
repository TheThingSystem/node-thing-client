// a node.js module to implement the Simple Thing Protocol
//   cf., http://thethingsystem.com/dev/Simple-Thing-Protocol.html

var events      = require('events')
  , fs          = require('fs')
  , mdns        = require('mdns')
  , os          = require('os')
  , speakeasy   = require('speakeasy')
  , util        = require('util')
  , ws          = require('ws')
  ;


var DEFAULT_LOGGER = { error   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , warning : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , notice  : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , info    : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     , debug   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
                     };


var Singleton = function(options) {
  var i, iface, ifaces, ifname, k;

  var self = this;

  if (!(self instanceof Singleton)) return new Singleton(options);

  self.options = options || {};

  self.logger = self.options.logger  || {};
  for (k in DEFAULT_LOGGER) {
    if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof self.logger[k] === 'undefined'))  self.logger[k] = DEFAULT_LOGGER[k];
  }

  ifaces = os.networkInterfaces();
  self.ifaddrs = [];
  for (ifname in ifaces) if (ifaces.hasOwnProperty(ifname)) {
    iface = ifaces[ifname];
    for (i = 0; i < iface.length; i++) {
      if ((!iface[i].internal) && (iface[i].family === 'IPv4')) self.ifaddrs.push(iface[i].address);
    }
  }

  self.hosts = {};
  try {
    self.mdns = mdns.createBrowser(mdns.tcp('wss')).on('serviceUp', function(service) {
      for (i = 0; i < service.addresses.length; i++) {
        if (self.ifaddrs.indexOf(service.addresses[i]) !== -1) {
          service.localhost = true;
          break;
        }
      }

      self.hosts[service.host] = service;
    }).on('serviceDown', function(service) {
      delete(self.hosts[service.host]);
    }).on('serviceChanged', function(service) {
      self.hosts[service.host] = service;
    }).on('error', function(err) {
      self.logger.error('_wss._tcp', { event: 'mdns', diagnostic: err.message });
    });
    self.mdns.start();
  } catch(ex) {
    self.logger.error('_wss._tcp', { event: 'browse', diagnostic: ex.message });
  }
};


var singleton = new Singleton();

/* options:

    for logging
      logger.*        : function(msg, props);

    for web sockets
      params.url      : complete 'ws:' or 'wss:' URL


    to identify steward
      steward.name    : e.g., IP address, 127.0.0.1/localhost, place1.name
      steward.uuid    : e.g., 2f402f80-da50-11e1-9b23-0123456789ab
      steward.crtData : steward's certificate (either as a buffer or array)
      steward.crtPath : pathname to file containing steward's certificate

 */

var ThingAPI = function(options) {
  var k;

  var self = this;

  if (!(self instanceof ThingAPI)) return new ThingAPI(options);

  self.options = options || {};

  self.logger = self.options.logger  || {};
  for (k in DEFAULT_LOGGER) {
    if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof self.logger[k] === 'undefined'))  self.logger[k] = DEFAULT_LOGGER[k];
  }
  if (!singleton.options.logger) {
    singleton.options.logger = self.logger;
    singleton.logger = self.logger;
  }

  self.params = self.options.params || {};

  if (!!self.params.url) return self._channel(self);

  if (!self.options.steward) self.options.steward = {};

  setTimeout(function() {
    var didP, entry, host;

    if ((self.options.steward.name === '127.0.0.1') || (self.options.steward.name === 'localhost')) {
      self.params.url = 'ws://localhost:8887';
      return self._channel(self);
    }

    if ((!!self.options.steward.name) && (self.options.steward.name.length === 0)) delete(self.options.steward.name);

    didP = false;
    for (host in singleton.hosts) if (singleton.hosts.hasOwnProperty(host)) {
      didP = true;
      entry = singleton.hosts[host];

      if (   ((!!self.options.steward.name)
                  && (entry.host !== (self.options.steward.name + '.' + entry.replyDomain))
                  && (entry.name + '.' + entry.replyDomain !== self.options.steward.name + '.')
                  && (entry.txtRecord.name !== self.options.steward.name))
          || ((!!self.options.steward.uuid) && (entry.txtRecord.uuid !== self.options.steward.uuid))) continue;

      if ((!self.options.steward.crtData) && (!self.options.steward.crtPath)) {
        self.params.url = 'ws://' + entry.host + ':8887';
      } else {
        self.params.url = 'wss://' + entry.host + ':' + entry.port;
      }

      return self._channel(self);
    }

    return self.emit('error', new Error(didP ? 'no matching stewards' : 'no visible stewards'));
  }, 250);

  return self;
};
util.inherits(ThingAPI, events.EventEmitter);


ThingAPI.prototype._channel = function(self) {
  if (util.isArray(self.options.steward.crtData)) self.options.steward.crtData = new Buffer(self.options.steward.crtData);
  self.params.ca = self.options.steward.crtData;
  if ((!self.params.ca) && (!!self.options.steward.crtPath)) self.params.ca = fs.readFileSync(self.options.steward.crtPath);
  if (!!self.params.ca) self.params.ca = [ self.params.ca ];

  self.channel = new ws(self.params.url + '/manage', self.params).on('open', function() {
    self.reqno = 1;
    self.callbacks = {};

    self.addCallback = function(cb, atMost) {
      self.callbacks[self.reqno.toString()] = { callback: cb, times: atMost };
      return self.reqno++;
    };

    if (!!self.options.state) {
      self.thingID = self.options.state.thingID;
      self.params = self.options.state.params;
      return self._hello();
    }

    if (!!self.options.pairing) return self._pair();

    return self.emit('error', new Error('no pairing information'));     
  }).on('message', function(data, flags) {
    var callback, doneP, message, requestID;

    if ((!!flags) && (flags.binary === true)) return self.emit('error', new Error('binary message'));

    try { message = JSON.parse(data.toString()); } catch(ex) {return self.emit('error', new Error('error parsing message')); }

    if (!!message.path) return self.emit('message', message);

    requestID = message.requestID.toString();

    if (!self.callbacks[requestID]) return;

    callback = self.callbacks[requestID].callback;

    doneP = (self.callbacks[requestID].times-- < 2) || (!!message.error);
    if (doneP) delete(self.callbacks[requestID]);
    callback(message, doneP);
  }).on('close', function() {
    self.emit('close');
  }).on('error', function(err) {
    self.emit('error', err);
  });

  return self;
};

ThingAPI.prototype._pair = function() {
  var json, thingUUID;

  var self = this;

  if (!self.channel)  throw new Error('channel not open');

  thingUUID = self.options.pairing.thingUUID;
  json = { path        : '/api/v1/thing/pair/' + thingUUID
         , name        : thingUUID
         };
  if (self.options.pairing.code) json.pairingCode = self.options.pairing.code;

  return self._send(json, function(message, doneP) {
    if (!!message.error) return self.emit('error', new Error(message.error.diagnostic), message.error);
    if (!doneP) return;

    self.thingID = message.result.thingID;
    self.params = message.result.params;
    delete(message.result.success);

    self._hello();
  }, false);
};

ThingAPI.prototype._hello = function() {
  var json;

  var self = this;

  if (!self.channel)  throw new Error('channel not open');

  json = { path      : '/api/v1/thing/hello/' + self.thingID
         , response  : speakeasy.totp({ key: self.params.base32, length: 6, encoding: 'base32', step: self.params.step })
         };

  return self._send(json, function(message) {
    if (!!message.error) return self.emit('error', new Error(message.error.diagnostic), message.error);

    self.emit('ready', { thingID: self.thingID, params: self.params });
  });
};

ThingAPI.prototype._send = function(json, callback, onceP) {
  var self = this;

  if (!self.channel) throw new Error('channel not open');

  json.requestID = self.addCallback(callback, onceP ? 1 : 2);
  self.channel.send(JSON.stringify(json));

  return self;
};


ThingAPI.prototype.prototype = function(things, cb) {
  return this._send({ path      : '/api/v1/thing/prototype/'
                    , things    : things
                    }, cb);
};

ThingAPI.prototype.register = function(things, cb) {
  return this._send({ path      : '/api/v1/thing/register/'
                    , things    : things
                    }, cb);
};

ThingAPI.prototype.update = function(things, cb) {
  return this._send({ path      : '/api/v1/thing/prototype/'
                    , things    : things
                    }, cb);
};

ThingAPI.prototype.report = function(events, cb) {
  return this._send({ path      : '/api/v1/thing/report/'
                    , events    : events
                    }, cb);
};


exports.ThingAPI = ThingAPI;
