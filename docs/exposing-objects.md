
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