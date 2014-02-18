node-taas-client
================
A node.js module to interface with TheThingSystem steward, as a thing.

This package implements a node.js module for the
[Simple Thing Protocol](http://thethingsystem.com/dev/Simple-Thing-Protocol.html).


Install
-------

    npm install thing-client

API
---

### Ready!

    var ThingAPI = require('thing-client');

### Set!

You can identify the steward by either:

- steward.name:
    - IP address, e.g., '192.168.1.xxx', or '127.0.0.1'
    - domain name, e.g., 'zekariah', or 'localhost'
    - place name, i.e., place1.name such as 'zephyr'

- steward.uuid:
    - place UUID, e.g., 2f402f80-da50-11e1-9b23-0123456789ab

The place and the UUID are advertised by the steward on the local network.
You should also include a reference to either the location of the steward's certificate file (steward.crtPath)
or the actual certificate itself (steward.crtData).

The very first time that your thing talks to the steward, it must pair.
In order to pair, you must provide, at a minimum, a UUID for the thing.
In addition, if the steward is configured to require a pairing code, then that too must be supplied.
When the 'ready' event is emitted,
it is passes a state variable that should be used as a parameter the next time the API is started.

The API does not attempt to recover on either a close, or error.
Instead, you may choose to start over or exit, as you see fit.


    var steward = new ThingAPI.ThingAPI(
    { steward : { name      : 'steward.local'
                , crtPath   : 'server.crt'
                }
    , pairing : { thingUUID : '...'
    //          , code      : '...'
                }
    /*
    , state   : state
     */
    }).on('ready', function(state) {
      // save state to pass as option for the future

      // ok, let's get to work!
    }).on('close', function() {
      // typically, just log and recover/exit
    }).on('error', function(err) {
      // typically, just log and recover/exit
    });

### Go!

To understand how to use these operations, please read
[Simple Thing Protocol](http://thethingsystem.com/dev/Simple-Thing-Protocol.html).

    // invoked exactly once
    var cb1 = function(message) { ... };


    steward.prototype(things, cb1);

    steward.register(things, cb1);

    steward.update(things, cb1);

    steward.report(events, cb1);

    steward.on('emit', cb1);    // an event

### Finally!

Enjoy.

License
=======

[MIT](http://en.wikipedia.org/wiki/MIT_License) license. Freely have you received, freely give.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
