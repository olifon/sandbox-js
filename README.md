# JailJS

This small javascript library can sandbox javascript, this means that the javascript gets a new global root. You can run any javascript code that may be malicious. It is a safe sandbox that the javascript can't escape and where your main code has full control over such as inspecting objects, evaling code in different ways, timeouts, invoking functions, adding API functions, etc. Most of the sandboxes expose a lot of functions and objects to the code. Most of those exposed objects are not needed for the code. Also they have very limited API for the sandbox, most of them can only execute code and print a (primitive) returned value. 

This sandbox however can do a lot of things. You can insert your own API functions that are exposed to code in the sandbox, set what the sandbox is allowed to,
add Synchronous functions (if those functions are invoked, the sandbox 'freezes' and waits for a return from the main) and Asynchronous functions, it runs the sandbox in a different thread with a different javascript context (so that it can never block your main program), invoke functions and wait on promises, staring up multiple sandboxes concurrently, and you can inspect (or modify) any javascript object using the API with this sandbox, including custom made javascript objects. Objects supported out of the box: all primitives including symbol and bigint, arrays, promise, functions, map, set, date, and more.


## Getting Started

There are no other libraries required for this library. The only thing that is required is a browser that supports Web Workers and Ecmascript 2015.

You need to add both 'jailjs.js' and 'jailed.js' to your project, but only include 'jailjs.js' (it is not a module) as a source file. The 'jailed.js' is the source code for the worker where the jailed code is going to be executed in. You can change the 'jailedPath' variable in jailjs.js to change the location of the jailed.js file.

Try it out: https://olifon.github.io/sandbox-js/terminal.html

termlib.js, test.js, test.html and terminal.html are used for the DEMO (not part of the library). You only need jailed.js and jailjs.js, just copy paste them in your project.


Examples:

```Javascript
var jail = new JailJS();
var root = jail.root;

root.set('print', console.log);
jail.execute('print("Hello from sandboxed code!");');
jail.terminate();
```

```Javascript
(async function() {
    var jail = new JailJS();
    var root = jail.root;

    console.log(await (await jail.execute('(function(x, y) {return x + " " + y;})')).invoke(['Hello', 'World']));
    jail.terminate();
})();
```

## Supports
1. Remote control of the objects inside Jail
2. All primitive values (including BigInt and Symbol)
3. Completely safe against modification of core javascript objects: (deletion and modifiying)
```Javascript
(async function() {
    var jail = new JailJS();
    var root = jail.root;

    jail.ping().then(() => console.log("pong"))

    console.log(await root.get("String")); //JailObject
    console.log(await root.get("Number")); //JailObject
    
    //malicious code deletes all core objects (or modifies it)
    await jail.execute('Object.prototype.toString = function() {throw new Error("Nope");}');
    await jail.execute('for(var item of Object.getOwnPropertyNames(self)) { try { delete self[item]; } catch(ex) {} }'); //no error
    await jail.execute('Symbol = function() {throw new Error("Nope");}'); //no error
    await jail.execute('self.String = function() {throw new Error("Haha, no");}'); //no error

    console.log(await root.get("String")); //JailObject
    console.log(await root.get("Number")); //undefined
    console.log((await jail.execute("'It still ' + 'works'"))); //It still works
    console.log((await jail.execute("3n+3n+5n+6n"))); //17n
    console.log(await (await jail.execute('(function(x, y) {return x + " " + y;})')).invoke(['Hello', 'World'])); //Hello world
    root.set('print', console.log);
    var sym = Symbol("Hi");
    root.set('sym', sym)
    root.set('sym2', Symbol('Hello'));
    jail.execute('print("Also with symbols:", sym);') //Also works with Symbols: Symbol(Hi)
    console.log((await root.get('sym')) == sym); //true
    console.log((await root.get('sym2')) == sym); //false
    jail.execute('while(1){}');
    //important, do the timeout after executing malicious code. It does a jail.ping() and if it does not respond it will kill the jail.
    jail.timeoutAfter(500).catch(ex => console.error(ex)); //The jail timed out after 500 milliseconds of delay.
})();
```
Safe against ALL modifications of core javascript objects and code injection (like }...{)

4. Runs in a different javascript context with a different global
There is no point of grabing a object so that you can break out of the sandbox.
Things like return new Function("return this") won't return the 'real' global, because there is no 'real' global.
The code runs in a new global with its own context in a seperate thread, and not in (like other sandbox programs) in a closure.

5. Most of the fuctions are disabled, only vanilla javascript functions (conform to Ecmascript specification) are enabled. This means that Network I/O, storage, Files and Blobs are disabled by default. You can enable them in the sandbox however, but it is not recommended. Untrusted code can make HTTP request with the cookies and authorization tokens from the user if you expose XMLHttpRequest for example. Expose nothing and make functions your self (with root.set(name, func)) which checks and sanitizes any input/output from the sandbox. (All of the built-in events are also disabled, except error, unhandledrejection and rejectionhandled. The sandbox can still create custom events and the event 'message' for an alternative communication between main and sandbox (see 7))

6. Shared functions between the sandbox and the main will always return Promises (this is because Worker communication is asynchronous). If a API returns a promise (for example root.get('promise'), where promise is a variable containing a Promise) will return a JailPromise. This is to prevent chaining (a promise cannot return a promise without chaining). You can get the original promise with the .value property of a JailPromise.

7. Worker-like message communication is also supported:
```Javascript
(async function() {
    var jail = new JailJS();
    var root = jail.root;

    jail.addMessageListener(async m => console.log('Worker:', m instanceof JailObject ? await m.resolve(true) : m)); //we will resolve all objects
    root.set('print', async (...d) => console.log(...(await Promise.all(d.map(z => z instanceof JailObject ? z.resolve() : z))))); //A console API is not exposed to the sandbox, by default. We need to create a print function
    jail.execute("this.addEventListener('message', m => print('Main:', m.data))");

    //anything that can be send with for example .set on objects can be sent using postMessage (and that is a lot of things including a JailObject)
    jail.postMessage("Hello world");
    jail.postMessage(new Date());
    jail.postMessage({age: 100, name: 'javascript'})

    var o = new Map();
    o.set("X", "Y");
    o.set("Y", "Z");
    jail.postMessage(o);
    
    var obj = await jail.createEmptyMap();
    var map = obj.valueOf(); //returns JailMap
    map.set("A", "B");
    map.set("C", "D");
    jail.postMessage({map: obj, nested: true});
    jail.execute('postMessage("Hello world");');
    jail.execute('postMessage([1,2,3,4,5]);')
    await jail.execute('postMessage(new Set([1,1,2,2,5,6,7]));');
    //if you terminate, no new tasks can be performed
    //to prevent race conditions, you could use await onReady()
    //this waits untils the task buffer is empty and ALLOWS new tasks to be added.
    //if you don't do this, and you would receive a message in the termination process. You cannot resolve the value because no new tasks can be performed.
    await jail.onReady();
    jail.terminate();
})();
```

8. Synchronous API supported
Normally, API functions always return Promises. Now you can also register functions that do return directly in the sandbox.
The sandbox will wait for the function in the main thread to finish before returning. 
The only small problem is that the sandbox is frozen.

Example:

```javascript
(async function() {
    var jail = new JailJS();
    var root = jail.root;

    root.set('print', async (...d) => console.log(...(await Promise.all(d.map(z => z instanceof JailObject ? z.resolve() : z))))); //A console API is not exposed to the sandbox, by default. We need to create a print function

    //you must inform the JailJS that you are going to use synchronous apis
    //this call may fail if the browser does not support Atomics
    await jail.enableSynchronousAPI();

    //you can register synchronous functions with the JailSynchronousFunction() constructor
    function spaces(len) {
        var str = '';
        for(var i = 0; i < len; i++) {
            str += ' ';
        }
        return str;
    }
    root.set('spaces', new JailSynchronousFunction(spaces));
    await jail.execute('print(spaces(20));');

    //most common and safe way is to register simple functions in the sandbox
    //normally, if a synchronous function returns a promise, that promise will not be resolved before the functions returns
    //the entire promise will be the return of the synchronous function

    root.set("resolver1", new JailSynchronousFunction(Promise.resolve.bind(Promise)));
    await jail.execute('print(resolver1("Hello world"));'); //JailPromise resolved "Hello world"

    //you can change this behaviour by setting the promise argument to true. (false is default)
    //if promise=true, the jail will wait on the promise before returning from the synchronous function
    //you actually make a asynchronous function, synchronous function in jail.
    root.set("resolver2", new JailSynchronousFunction(Promise.resolve.bind(Promise), true));
    //nows it just waits on the promise instead of returning the promise itself
    await jail.execute('print(resolver2("Hello world"));'); //Hello world (not a promise!)

    //NOTE: if you set promise to true, ANY api function (such as .get()) will not resolve until the promise of the synchronous function is resolved
    //So you should not use any api function inside a synchronous function with a promise.
    root.set("hello", "world");
    root.set("safelock", new JailSynchronousFunction(() => root.get("hello"), false));
    root.set("deadlock", new JailSynchronousFunction(() => root.get("hello"), true));
    //this will not result in a deadlock, and returns a promise that resolves to "world"
    console.log(await (await jail.execute("safelock()")).resolve()); //JailPromise resolved "world"
    //this will result in a deadlock, because it uses a api function in a asynchronous function (that is made synchronous)
    //console.log(await (await jail.execute("deadlock()")).resolve()); //never resolves, jail is frozen
    
    await jail.onReady();
    await jail.terminate();
})();
```
So if you make asynchronous function, synchronous for the sandbox, it is limited. You cannot use the sandbox API in those functions.

You can test it with: 
```javascript 
loadFileSync("test-file.txt") //"Lorum ipsum..."
```
and
```javascript
loadFile("test-file.txt") //Promise resolved "Lorum ipsum..."
```

both functions use Network I/O on the main thread, that is asynchronous
The function is made synchronously in the jail with loadFileSync

Atomics (and shared javascript memory) support is limited (2021). So it does not work on all browsers.

**NOTE**: DO NOT COMPILE or BUNDLE jailed.js with tools like Webpack or Babel. Those tools introduce extra values to jailed.js that could leak some objects for the sandboxed code. It also add extra global values, change the closures etc, and a possible chance that jailed.js won't work anymore. Especially for the bundlers, those insert extra code that is not made to be run in a sandboxed environment. Because that code is always ran first, the chance is very high that it would expose a ton of objects to the sandboxed code. However, it is perfectly fine to bundle and compile jailjs.js (the script that runs on the main thread, because it does not execute any code, it only instructs the Worker to execute code), but do not bundle jailed.js. Edit your webpack config that jailed.js needs to be left unmodified. If you use bundlers, you may change the path to the jailed.js in jailjs.js. (jailedPath=)

## Benefits of JailJS

1. It is completely safe, the code runs in a completely seperated and isolated javascript context. It cannot access any of the variables from the main program. And it can neither access dangerous functions in the worker's global like postMessage.
2. It is fast, you don't have to check the code before it is executed. The code runs in a native VM provided by the browser. The code can only access some basic functions and objects. You can whitelist more features if you want.
3. No Denial of Service attacks, all tasks returns promises. Whenever the code is going to execute some nasty code (like while(true) {}), you can set timeouts that will stop the worker when the execution takes too long.
4. No limits. No features of Ecmascript are blocked because of security and vulnerabilities. The sandboxed code can use any basic function or object. You can also whitelist more objects provided by the worker like 'XMLHttpRequest'

**NOTE**: Do not whitelist objects like XMLHttpRequest for untrusted code. The Worker runs with the same origin as the website. This means it can access all the cookies, storages (like indexed db) etc. All of this is disabled by default of course and only vanilla JS objects are exposed. Try to create own API functions, that validates data, and expose them to the sandbox with root.set.

5. You have full control over the code that is going to be executed. There is no way that the malicious code can delete or modifiy this access.

## Exposing objects
It is possible to expose objects and functions to the sandbox. The following types are supported:


**Objects from the MAIN:**

The following objects are supported. Those objects will then be **copied** to the Jail, so further edits on the objects do not have impact on the objects
in the jail

Primitives:
* number
* boolean
* string
* bigint
* symbol

Objects:
* Number
* Boolean
* String
* BigInt
* Symbol
* Date
* Map
* Set
* Error (also the vanilla javascript errors like TypeError)
* Object (plain javascript objects, prototype chain not walked)
* Function (see Function section)
* Promise (if the promise resolves in the main code it will be resolved (the value is copied) in the sandbox. Or rejected in the sandbox)
* TypedArray (such as UInt8Array and Float64Array)
  * Also as return value for synchronous functions
  * If a synchronous function returns a SharedArrayBuffer, the memory cannot be shared with the worker. A new shared array buffer is created on the worker with the same contents
  * If it is not to share memory: the SharedArrayBuffer will be copied and the memory is NOT shared (silent error)
    See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes
    * However you always can retrieve the contents of a buffer using the .get on the JailObject.
* ArrayBuffer and SharedArrayBuffer

There are two ways to get an object from the sandbox:
1. Reference to an object
   You can get a 'reference' to an object using the JailObject.
   The JailObject class has a lot of asynchronous functions to modify the object
   Such as setting properties, defining properties with descriptors, getting descriptors, freeze/seal the object, getting all the keys in the object, invoke functions, delete properties, setup getters/setters etc

   Functions are also JailObject and you can call them with the .invoke function
2. Resolving a object
   If you decide to resolve a object (if you have a reference, or you tell to the api that the object needs to be resolved immediately)
   then the object will be copied. Modifications made on the sandbox from that point do not reflect on the object in the main code and vice versa.
   There are two types of resolving:
   * Not deep:
     If you do not resolve a object 'deep', children properties will not be resolved.
     This means that if you resolve a JailObject that represents an array with objects (not deep), you will get an array of JailObjects
   * Deep:
     this means that the object is resolved entirely, including the children (and children of children etc) of the object.
     everything is copied to the main

   special resolve case:
   * Function: if a JailObject representing a 'Function' is resolved, a Function is returned that is linked with the function in the sandbox.
               calling that function will call the function in the sandbox. Those functions always return a Promise.
               If the function in the sandbox returns a Promise, the linked function will return a JailPromise (resolved) to prevent chaining
   * Promise:  if a JailObject representing a 'Promise' is resolved, a JailPromise is returned. 
               You can get a Promise instance from a JailPromise with the .value property.
               If the promises resolves in the sandbox or rejects it will also resolve/reject in the main.
   * SharedArrayBuffer:
               A SharedArrayBuffer, as the name implies, will share the memory with the sandbox. This will only happens if you browser allow sharing memory
               with a SharedArrayBuffer. If not, the contents of a SharedArrayBuffer is copied instead.
               

**Objects from the SANDBOX**


Primitives:
* number
* boolean
* string
* bigint
* symbol

All objects comming from the sandbox will return a JailObject (if not resolved), including Functions, Proxy etc.
Some objects can be resolved to an equivalent object for the main code:

Resolved objects:
* Number
* Boolean
* String
* BigInt
* Symbol
* Date
* Map
* Set
* JailError
  * If an Error is thrown, it will be thrown as a JailError. The JailError contains the stack from the main
  * the .cause will be set as a resolved Error object from the sandbox (with the stack from the sandbox)
  * You can get the JailObject from a JailError with the .obj property.
  * Stack main is : JailError.stack
  * Stack sandbox is : JailError.cause.stack
* Object (plain javascript objects, prototype chain not walked)
* Function (see Function section, will always return a Promise)
* JailPromise 
 * Resolved promises returned from the SANDBOX will always resolve in a JailPromise (a wrapper for a Promise).
 * This prevents chaining with the returned Promises from the API functions. 
 * You can get the original promise with the .value on JailPromise)
* TypedArray (such as UInt8Array and Float64Array)
* ArrayBuffer and SharedArrayBuffer

On all resolved objects, the enumerable properties of that object are also copied to the main object.
Only if they did not exist already on the object. (The sandbox cannot override properties)

You can also manipulate objects with the API:

Supports special operations on:
* Array
  * Check if array with .isArray()
  * You can get the length with .length() on a JailObject
  * You can add items with .set(await .length(), ...)
  * More operations will be added in the future
* Map
  * Entire API (JailMap)
  * Get the JailMap with .valueOf()
* Set
  * Entire API (JailSet)
  * Get the JailSet with .valueOf()
* Function
  * Invoke with .invoke
  * Support for constructors will be added in the future

You can retrieve some objects with the .valueOf() without resolving from a JailObject:
* Number object -> number primitive
* Boolean object -> boolean primitive
* String object -> string primitive
* BigInt object -> bigint primitive
* Symbol object -> symbol primitive
* Date
* Map -> JailMap
* Set -> JailSet
* Error
  * The valueOf() returns a Error (not a JailError), that is equal to the JailError.cause
  * You can get a JailError instance (which also contains the main stack) with getJailError()
* Function
  * Has a reference to the JailObject. It actually uses the .invoke on the JailObject
  * You can get the JailObject with the .wrapper property
* JailPromise

valueOf() does not send ask anything to the sandbox, information returned by valueOf() was already received by the sandbox.

Other things like plain javascript objects needs to be resolved.

Functions:
* All sort of functions
* Properties on the function objects are NOT exposed
* The 'this' value of the function will not be exchanged when a function is called.
  * The sandbox cannot change the 'this' for functions from the main code. So do not use those functions as functions on classes.
  * You can apply a 'this' for functions from the sandboxed, if you have the JailObject, with .invoke(this_arg, arguments_array)
* Functions from the sandboxed code always return Promises and cannot be made Synchronously (for security)
* Functions from the main code can be made Synchronously with the JailSynchronousFunction() (Atomics needs to be supported in browser)
  * First enable it with jail.enableSynchronousAPI();
  * There is no JailPromise class in the sandbox. So Promises returned by API functions exposed to the sandbox will be chained.


**Running code in the sandbox**
You can run code in the sandbox in different ways.
You can also provide a name for your scripts (useful with errors)

* jail.execute: (Globally) eval the code and return the value (not resolved)
* jail.executeAsResolved: (Globally) eval and return the value (as a resolved value, so it would never return a JailObject)
* jail.executeAsFunction: Execute the code in a new Function (Function does not run in a closure) and return the return value (not resolved)
* jail.executeAsAsyncFunction: Execute the code in a new asynchronous Function (Function does not run in a closure) and return the return value (JailObject with a JailPromise)


## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
