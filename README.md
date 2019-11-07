# Chroot JS

This small javascript library can sandbox javascript, this means that the javascript gets a new global root. You can run any javascript code that may be malicious. It is a safe sandbox that the javascript can't exit and where you have full control over.


## Getting Started

There are no other libraries required for this library. The only thing that is required is a browser that supports Web Workers and Ecmascript 2015.

You need to add both 'jailjs.js' and 'jailed.js' to your project, but only include 'jailjs.js' (it is not a module) as a source file. The 'jailed.js' is the source code for the worker where the jailed code is going to be executed in. You can change the 'jailedPath' variable in jailjs.js to change the location of the jailed.js file.

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

## Benefits of chroot JS

1. It is completely safe, the code runs in a completely seperated and isolated javascript context. It cannot access any of the variables from the main program. And it can neither access dangerous functions in the worker's global like postMessage.
2. It is fast, no checks are required before the code is exeucted. The code runs in a native VM from the browser. The code can only access some basic functions and objects that only can affect their own stuff. You can whitelist more features if you want.
3. No Denial of Service attacks, all tasks returns promises. Whenever the code is going to execute some nasty code (like while(true) {}), you can set timeouts that will stop the worker when the execution takes too long.
4. No limits. No features of Ecmascript are blocked because of security and vulnerabilities. The jailed code can use any basic function or object. You can also whitelist more objects provided by the worker like 'XMLHttpRequest'
5. You have full control over the code that is going to be executed. You can access any objects in the global scope and execute at any time any code that you want. There is no way that the malicious code can delete or modifiy this access.

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details