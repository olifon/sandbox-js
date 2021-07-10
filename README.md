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

## Benefits of chroot JS

1. It is completely safe, the code runs in a completely seperated and isolated javascript context. It cannot access any of the variables from the main program. And it can neither access dangerous functions in the worker's global like postMessage.
2. It is fast, you don't have to check the code before it is executed. The code runs in a native VM provided by the browser. The code can only access some basic functions and objects. You can whitelist more features if you want.
3. No Denial of Service attacks, all tasks returns promises. Whenever the code is going to execute some nasty code (like while(true) {}), you can set timeouts that will stop the worker when the execution takes too long.
4. No limits. No features of Ecmascript are blocked because of security and vulnerabilities. The jailed code can use any basic function or object. You can also whitelist more objects provided by the worker like 'XMLHttpRequest'
5. You have full control over the code that is going to be executed. There is no way that the malicious code can delete or modifiy this access.

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
