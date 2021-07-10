# Chroot JS

This small javascript library can sandbox javascript, this means that the javascript gets a new global root. You can run any javascript code that may be malicious. It is a safe sandbox that the javascript can't exit and where you have full control over.


## Getting Started

There are no other libraries required for this library. The only thing that is required is a browser that supports Web Workers and Ecmascript 2015.

You need to add both 'jailjs.js' and 'jailed.js' to your project, but only include 'jailjs.js' (it is not a module) as a source file. The 'jailed.js' is the source code for the worker where the jailed code is going to be executed in. You can change the 'jailedPath' variable in jailjs.js to change the location of the jailed.js file.


Try it out: https://olifon.github.io/sandbox-js/terminal.html

Examples of chroot JS:

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
Normally, API functions always return Promises. Now you can also register functions that do return directly in the Jail.
The Jail will wait for the function in the main thread to finish before returning. 
The only small problem is that the jail is frozen.

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
So if you make asynchronous function, synchronous for the jail, it is limited. You cannot use the jail API in those functions.


## Benefits of chroot JS

1. It is completely safe, the code runs in a completely seperated and isolated javascript context. It cannot access any of the variables from the main program. And it can neither access dangerous functions in the worker's global like postMessage.
2. It is fast, you don't have to check the code before it is executed. The code runs in a native VM provided by the browser. The code can only access some basic functions and objects. You can whitelist more features if you want.
3. No Denial of Service attacks, all tasks returns promises. Whenever the code is going to execute some nasty code (like while(true) {}), you can set timeouts that will stop the worker when the execution takes too long.
4. No limits. No features of Ecmascript are blocked because of security and vulnerabilities. The jailed code can use any basic function or object. You can also whitelist more objects provided by the worker like 'XMLHttpRequest'
5. You have full control over the code that is going to be executed. There is no way that the malicious code can delete or modifiy this access.

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
