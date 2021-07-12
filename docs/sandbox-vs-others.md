## What is the difference between other sandboxes ##
Other sandboxes have a quite limited in API. They only allow you to execute some code, and a very simple messaging API
Some of them compiles javascript code, they may be secure but their javascript fuctionality is limited.
This sandbox howevers can use any fuctionality from the javascript engine. So you can use the this value, prototypes classes etc.
This sandbox also allows you to pass Buffers, Promises, functions from the main etc.

There are a lot of sandboxes made for node.js, however this sandbox is NOT made for node.js but instead your browser. This sandbox also uses the same origin policy and sets the origin to "null" in the sandbox. When you try to access IndexedDB for example you get: "indexedDB is not defined" or location: "location is not defined". You can verify this to go to Element Inspect. Click the 'context' dropdown and select the worker. If you run in the console "this" you will see that only a few objects are exposed on this (only the vanilla emscripten/javascript objects).

Even if you run this dangerous code
```javascript
jail.whitelistAllFeatures(); //dangerous, exposes a lot of API to the sandboxed
```

You would still get the error: Failed to execute 'open' on 'IDBFactory': access to the Indexed Database API is denied in this context.
and location.origin will return "null"

That means that if the script wants to break out, it first needs to break the javascript sandbox and it also needs to break out of your browsers sandbox.
