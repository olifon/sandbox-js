/*
    Code that runs on the main thread.
    You can compile or bundle this script (jailjs.js) with tools like babel or webpack.
    But DO not BUNDLE or COMPILE jailed.js

    This script does not 'eval' or execute any sandboxed code, it only instructs the worker.
    It also does not receive any javascript code from the worker (e.g object literals as JS), 
    instead it safely parses the messages (with a special syntax) with its own parser.
    This is not the case for data comming from the main thread (but it is allowed to execute code in the worker).
*/
this.jailFunc = (function (newThread, jailFunc, jailCode, subId) {
    var subIndex = 0;
    if(!jailFunc) {
        var jailFunc = this.jailFunc.toString();
        delete this.jailFunc;
    }
    this.JailError = class extends Error {
        constructor(innerError, message, obj) {
            super(message == null ? innerError : message);
            this.cause = message == null ? null : innerError;
            this.obj = obj == null ? null : obj; //undefined == null, will contain a copied object or a JailObject. May be modified
        }
    
        toString() {
            var str = super.stack || super.toString();
            if (this.cause != null) str += '\r\n' + this.cause.toString();
            return str;
        }
    
        get jailObj() {
            if (!this.obj) return null;
            if (this.obj instanceof JailObject) return this.obj;
            return null;
        }
    
        resolve(deep) {
            if (!this.obj) return Promise.reject(new Error("Does not have a sub error"));
            if (this.obj instanceof JailObject) return this.obj.resolve(deep);
            return Promise.resolve(this.obj);
        }
    }
    this.JailTerminatedError = class extends JailError {
        constructor(message) {
            super(null, message);
        }
    }
    this.JailSynchronousFunction = class {
        constructor(func, promise) {
            if (!(func instanceof Function)) throw new Error("Func argument needs to be a function");
            this.value = func;
            this.promise = !!promise;
            Object.freeze(this);
        }
    }
    this.JailVoidFunction = class {
        constructor(func) {
            if (!(func instanceof Function)) throw new Error("Func argument needs to be a function");
            this.value = func;
            Object.freeze(this);
        }
    };
    /*
      This class wraps promises from the Jailed environment.
      It is needed because you cannot let a promise return an another promise (without chaining).
    
      For example: Promise.resolve(Promise.resvolve("Hello")) will resolve to "Hello" and not a Promise.
      This is because of how the chaining in Promises works.
      To prevent chaining of the promises that jailed functions returns with the promises from the API, a wrapper is used.
    */
    this.JailPromise = class {
        constructor(promise) {
            //We must prevent an uncaught error in the main if the jailed environment returned a promise
            if (promise instanceof JailPromise) promise = promise.value;
            if (!(promise instanceof Promise)) throw new TypeError('The promise argument needs to be a Promise');
            Object.defineProperty(this, 'value', { enumerable: true, configurable: false, writable: false, value: promise });
            var success = false;
            var error = false;
            Object.defineProperty(this, "success", { get: () => success, set: () => success, configurable: false });
            Object.defineProperty(this, "error", { get: () => error, set: () => error, configurable: false });
            promise.then(() => success = true, () => error = true);
        }
    
        //we may NOT add a THEN function, because then JS will see our object as a promise-like object and will chain it.
        finish(...args) {
            return this.value.then(...args);
        }
    
        except(...args) {
            return this.value.catch(...args);
        }
    
        finally(...args) {
            return this.value.finally(...args);
        }
    
        toString() {
            return JailJS.variableToString(this);
        }
    }

    /**
     * Specify here the path of the 'jailed.js'
     */
    var jailedPath = 'jailed.js';
    /**
     * The tokenizer class is used to scan responses from the recieved jailed messages.
     */
    class Tokenizer {
        str;
        index = 0;
        stack = [];
        constructor(str) {
            this.str = str;
        }


        next(token) {
            if (this.index >= this.str.length) return null;
            var ind = this.index + token.length;
            if (ind >= this.str.length) return false;
            var part = this.str.substring(this.index, ind);
            if (part == token) {
                this.index = ind;
                return true;
            }
            return false;
        }

        name() {
            if (this.index >= this.str.length) return null;
            var strchr = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
            var strchr2 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
            for (var i = this.index; i < this.str.length; i++) {
                var chr = this.str.charAt(i);
                if (i > this.index) {
                    if (!strchr2.includes(chr)) {
                        var str = this.str.substring(this.index, i);
                        this.index = i;
                        return str;
                    }
                } else {
                    if (!strchr.includes(chr)) {
                        return null;
                    }
                }
            }
            var str = this.str.substring(this.index);
            this.index = this.str.length;
            return str;
        }
        string() {
            if (this.index >= this.str.length) return null;
            if (this.str.charAt(this.index) != '"') return null;
            this.index++;
            for (var i = this.index; i < this.str.length; i++) {
                var chr = this.str.charAt(i);
                if (chr == '\\') {
                    i++;
                } else if (chr == '"') {
                    var str = this.str.substring(this.index, i);
                    this.index = i + 1;
                    return JSON.parse('"' + str + '"');
                }

            }
            var str = this.str.substring(this.index);
            this.index = this.str.length;
            return JSON.parse('"' + str);
        }

        number() {
            if (this.index >= this.str.length) return null;
            var numchr = '0123456789.'
            var numchr2 = '0123456789.oOxXbB'
            var may = false;
            for (var i = this.index; i < this.str.length; i++) {
                var ch = this.str.charAt(i);
                if (i == this.index) {
                    if (ch == '0') {
                        may = true;
                        continue;
                    } else if (ch == '-' || ch == '+');
                    else if (!numchr.includes(ch)) {
                        return null;
                    }
                } else {
                    if (!(may ? numchr2.includes(ch) : numchr.includes(ch))) {
                        var num = Number(this.str.substring(this.index, i));
                        this.index = i;
                        return num;
                    }
                    may = false;
                }
            }
            var num = Number(this.str.substring(this.index));
            this.index = this.str.length;
            return num;
        }

        startCall() {
            if (this.index >= this.str.length) return null;
            if (this.str.charAt(this.index) == '(') {
                this.stack.push(')');
                this.index++;
                return true;
            }
            return false;
        }

        startObject() {
            if (this.index >= this.str.length) return null;
            if (this.str.charAt(this.index) == '{') {
                this.stack.push('}');
                this.index++;
                return true;
            }
            return false;
        }

        startArray() {
            if (this.index >= this.str.length) return null;
            if (this.str.charAt(this.index) == '[') {
                this.stack.push(']');
                this.index++;
                return true;
            }
            return false;
        }

        end() {
            if (this.index >= this.str.length) return null;
            if (this.stack.length < 1) return false;
            if (this.stack[this.stack.length - 1] == this.str.charAt(this.index)) {
                this.stack.pop();
                this.index++;
                return true;
            }
            return false;
        }
    };
    /*
        These symbols are used to access private variables in
        the classes from jailjs. You may alter these variables (eg using Object.getOwnPropertySymbols),
        but it is deprecated and not recommended..
    */
    var resolvedBuffers = self.WeakMap ? new WeakMap() : new Map();
    /**
     * The wrapper secret is used to create a JailObject,
     * normally only toJailObject uses this secret. If some code from jailjs.js
     * wants to wrap a jailed object, it uses toJailObject. If you want
     * to get a jailed object, you can get it from one of the task functions. (like execute)
     */
    var wrapper_secret = Symbol('wrapper_secret');
    /**
     * The jail_eval property returns the special jail eval function that has also
     * some properties that are useful for the jail session.
     */
    var jail_eval = Symbol('jail_eval');
    /**
     * The jail_index property returns the ID (becuase every jailed object has an ID) for the
     * JailObject.
     */
    var jail_index = Symbol('jail_index');
    /**
     * If the jail_object has this property (set to non undefined), the JailObject is a special
     * type. That type can be:
     * 
     * * A JailPromise
     * * jailed_function if the JailObject is a function
     * * jailed_array if the JailObject is an array
     * * A primitive value that the object wraps to (eg String wraps to a string). 
     * * * Note that jailed_function and jailed_array are also primitive symbols with an other purpose.
     */
    var jail_primitive = Symbol('jail_primitive');
    /**
     * This is one of the possible value for jail_primitive. It means that the object
     * is an jailed function See jail_primitive.
     */
    var jail_function = Symbol('jailed function');
    /**
     * This is one of the possible value for jail_array. It means that the object
     * is an jailed array See jail_primitive.
     */
    var jail_array = Symbol('jailed array');
    /**
     * This means that a 'jailobject' is a typed array.
     */
    var jail_buffer = Symbol('jailed buffer');
    /**
     * We use the stament 'throw jail_error()' to indicate that the message
     * recieved from the jail was incorrect. Normally this means that there is a bug.
     */
    var jail_error = () => new JailError(null, 'Incorrect message from jail.');
    /**
     * the toJailObject is used to wrap a JailObject from an ID for a jailed object.
     * 
     * the toJailObject checks if that object was already created and returns that object
     * if that is true. (that is why JailObject equals when they are the same object).
     * Otherwise it creates a new object.
     * 
     * @param {Function} j_eval the session of the jailed object.
     * @param {number} index the ID for the jailed object
     * @param {boolean|symbol|string|number|Promise|undefined} primitive_value the special value for the object.
     */
    var toJailObject = function (j_eval, index, primitive_value) {
        if (index in j_eval.objs) {
            return j_eval.objs[index];
        } else {
            var obj = new JailObject(wrapper_secret, j_eval, index, primitive_value);
            j_eval.objs[index] = obj;
            return obj;
        }
    }

    /**
     * Assign a returned object message from Jail to a main JS object.
     * @param {Function} jaileval 
     * @param {Tokenizer} tokenizer 
     * @param {Array} values 
     */
    var assign_object_from_value = function (jaileval, tokenizer, values) {
        if (tokenizer.startObject()) {
            while (!tokenizer.end()) {
                var key = toValue(jaileval, tokenizer);
                if (!tokenizer.next(':')) throw jail_error();
                var value = toValue(jaileval, tokenizer);
                tokenizer.next(',');
                if (key in values) continue; //the sandbox is NOT allowed to override properties
                values[key] = value;
            }
            return true;
        } else return false;
    }

    function numToText(num) {
        var t = '';
        for (var i = 0; i < 5; i++) {
            t += String.fromCharCode(35 + (num % 85));
            num = ~~(num / 85);
        }
        return t;
    }
    /*
         function textToNum(text) {
            if(text.length != 5) throw new TypeError("text length must be 5");
            var n = 0;
            for(var i = 4; i >= 0; i--) {
                if(i < 4) n *= 85;
                n += text.charCodeAt(i) - 35;
            }
            return n;
           
         }
    */


    const TypedArray = self.Uint8Array ? Object.getPrototypeOf(Uint8Array.prototype).constructor : null;
    function typedArrayToBuffer(array) {
        if (!(array instanceof TypedArray)) throw new TypeError("Data needs to be a an instanceof a TypedArray");
        return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset)
    }
    function binToCompressedText(data) {
        if (!(data instanceof ArrayBuffer) && (!self.SharedArrayBuffer || !(data instanceof SharedArrayBuffer))) data = typedArrayToBuffer(data);
        var len = data.byteLength;
        var ints = ~~(len / 4);
        var rem = len % 4;

        var res = new Array(ints + 1);
        res[0] = ''
        var arr = new Uint32Array(data.slice(0, ints * 4));
        for (var i = 0; i < ints; i++) {
            res[i] = numToText(arr[i]);
        }
        if (rem > 0) {
            arr = new Uint8Array(data.slice(ints * 4));
            var num = 0;
            //endianess worker == endianess host
            var narr = new ArrayBuffer(4);
            var z = new Uint8Array(narr);
            for (var i = 0; i < (4 - rem); i++) z[i] = arr[i];
            var num = (new Uint32Array(narr))[0];
            var mnum = 256 * rem;
            while (num < mnum) num *= 256;
            res[ints] = numToText(num);
        } else res[ints] = '';
        return res.join('');
    }
    /*
         function compressedTextToBin(txt) {
            var len = txt.length;
            if(len % 5 != 0) throw new TypeError("txt must be a multiple of 5");
            var data = new ArrayBuffer((len / 5) * 4);
            var arr = new Uint32Array(data);
            for(var i = 0; i < (len / 5); i++) {
                arr[i] = textToNum(txt.substring(i * 5, (i + 1) * 5));
            }
            return data;
         }
    */

    /**
     * Return the main JS value from a recieved jailed value.
     * @param {Function} jaileval the session for the jail.
     * @param {Tokenizer} tokenizer the tokenizer to read the value from.
     */
    var toValue = function (jaileval, tokenizer) {
        var val = tokenizer.string();
        if (val == null) val = tokenizer.number();
        if (val != null) return val;
        if (tokenizer.startArray()) {
            var values = [];
            while (!tokenizer.end()) {
                values.push(toValue(jaileval, tokenizer));
                tokenizer.next(',');
            }
            return values;
        } else {
            var obj = {};
            if (assign_object_from_value(jaileval, tokenizer, obj)) return obj;
        }
        var func = tokenizer.name();
        if (func == null) throw jail_error();
        func = func.toLowerCase();
        switch (func) {
            case 'self':
                return toJailObject(jaileval, 0, null);
            case 'nan':
                return NaN;
            case 'infinity':
                return Infinity;
            case 'infinity_negative':
                return -Infinity;
            case 'undefined':
                return undefined;
            case 'null':
                return null;
            case 'true':
                return true;
            case 'false':
                return false;
            case 'bigint':
                if (!tokenizer.startCall()) throw jail_error();
                var value = tokenizer.string();
                if (value == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error;
                return BigInt(value);
            case 'string':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index != null) {
                    if (!tokenizer.next(',')) throw jail_error();
                    var value = tokenizer.string();
                    if (value == null) throw jail_error();
                    if (!tokenizer.end()) throw jail_error();
                    return toJailObject(jaileval, index, value);
                } else {
                    var value = tokenizer.string();
                    if (value == null) throw jail_error();
                    var primitive = new String(value);
                    if (tokenizer.next(',')) {
                        if (!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
                    }
                    if (!tokenizer.end()) throw jail_error();
                    return primitive;
                }
            case 'boolean':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index != null) {
                    if (!tokenizer.next(',')) throw jail_error();
                    var value = tokenizer.name();
                    if (value == null) throw jail_error();
                    value = value.toLowerCase() == 'true' ? true : false;
                    if (!tokenizer.end()) throw jail_error();
                    return toJailObject(jaileval, index, value);
                } else {
                    var value = tokenizer.name();
                    if (value == null) throw jail_error();
                    var primitive = new Boolean(value.toLowerCase() == 'true' ? true : false);
                    if (tokenizer.next(',')) {
                        if (!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
                    }
                    if (!tokenizer.end()) throw jail_error();
                    return primitive;
                }
            case 'number':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                var isNext = false;
                if (tokenizer.next(',')) {
                    isNext = true;
                    var value = tokenizer.number();
                    if (value != null) {
                        if (!tokenizer.end()) throw jail_error();
                        return toJailObject(jaileval, index, value);
                    }
                }
                var value = index;
                var primitive = new Number(value);
                if (isNext) {
                    if (!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
                }
                if (!tokenizer.end()) throw jail_error();
                return primitive;
            case 'bigintobject':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) index = tokenizer.string();
                var isNext = false;
                if (tokenizer.next(',')) {
                    if (typeof index != 'number') throw jail_error();
                    isNext = true;
                    var value = tokenizer.string();
                    if (value != null) {
                        if (!tokenizer.end()) throw jail_error();
                        return toJailObject(jaileval, index, BigInt(value));
                    }
                }
                var value = index;
                var primitive = Object(BigInt(value));
                if (isNext) {
                    if (!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
                }
                if (!tokenizer.end()) throw jail_error();
                return primitive;
            case 'date':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                var isNext = false;
                if (tokenizer.next(',')) {
                    isNext = true;
                    var value = tokenizer.number();
                    if (value != null) {
                        if (!tokenizer.end()) throw jail_error();
                        return toJailObject(jaileval, index, new Date(value));
                    }
                }
                var value = index;
                var date = new Date(value);
                if (isNext) {
                    if (!assign_object_from_value(jaileval, tokenizer, date)) throw jail_error();
                }
                if (!tokenizer.end()) throw jail_error();
                return date;
            case 'promise':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error();
                if (index in jaileval.promises) {
                    return toJailObject(jaileval, index, jaileval.promises[index]);
                }
                var ind = -(jaileval.objscount);
                jaileval.objscount += 2;
                if (!('err' in jaileval))
                    jaileval("this.util.promiseThen(this.objs[" + String(index) + "], this.wrap('function'," + String(ind) + "), this.wrap('function'," + String(ind - 1) + "));");
                var promise = new JailPromise(new Promise(function (resolve, reject) {
                    jaileval.funcs[ind] = function (result) {
                        delete jaileval.funcs[ind];
                        delete jaileval.funcs[ind - 1];
                        resolve(result);
                    }
                    jaileval.funcs[ind - 1] = function (result) {
                        delete jaileval.funcs[ind];
                        delete jaileval.funcs[ind - 1];
                        reject(result);
                    }
                }));
                jaileval.promises[index] = promise;
                return toJailObject(jaileval, index, promise);
            case 'wrapperpromise':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error();
                if (index in jaileval.promises) {
                    return jaileval.promises[index];
                }
                var ind = -(jaileval.objscount);
                jaileval.objscount += 2;
                if (!('err' in jaileval))
                    jaileval("this.util.promiseThen(this.objs[" + String(index) + "], this.wrap('function'," + String(ind) + "), this.wrap('function'," + String(ind - 1) + "));");
                var promise = new JailPromise(new Promise(function (resolve, reject) {
                    jaileval.objs[ind] = function (result) {
                        delete jaileval.objs[ind];
                        delete jaileval.objs[ind - 1];
                        resolve(result);
                    }
                    jaileval.objs[ind - 1] = function (result) {
                        delete jaileval.objs[ind];
                        delete jaileval.objs[ind - 1];
                        reject(result);
                    }
                }));
                jaileval.promises[index] = promise;
                return promise;
            case 'function':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error();
                return toJailObject(jaileval, index, jail_function);
            case 'wrapperfunction':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error();
                return (toJailObject(jaileval, index, jail_function)).valueOf();
            case 'array':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error();
                return toJailObject(jaileval, index, jail_array);
            case 'object':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.end()) throw jail_error();
                return toJailObject(jaileval, index, null);
            case 'symbol':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.next(',')) throw jail_error();
                var name = tokenizer.string();
                if (name == null) {
                    if (!tokenizer.next('null')) throw jail_error();
                    name = undefined;
                }
                if (!tokenizer.end()) throw jail_error();
                var symbol;
                if (index in jaileval.symbol_index) {
                    symbol = jaileval.symbol_index[index];
                } else {
                    symbol = name == undefined ? Symbol() : Symbol(name);
                    jaileval.symbols[symbol] = index;
                    jaileval.symbol_index[index] = symbol;
                }
                return symbol;
            case 'symbolobject':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                if (!tokenizer.next(',')) throw jail_error();
                var name = tokenizer.string();
                if (name == null) {
                    if (!tokenizer.next('null')) throw jail_error();
                    name = undefined;
                }
                var symbol;
                if (index in jaileval.symbol_index) {
                    symbol = jaileval.symbol_index[index];
                } else {
                    symbol = name == undefined ? Symbol() : Symbol(name);
                    jaileval.symbols[symbol] = index;
                    jaileval.symbol_index[index] = symbol;
                }
                var hasNext = false;
                if (tokenizer.next(',')) {
                    hasNext = true;
                    var object_index = tokenizer.number();
                    if (object_index != null) {
                        if (!tokenizer.end()) throw jail_error();
                        return toJailObject(jaileval, object_index, symbol);
                    }
                }
                var obj = Object(symbol);
                if (hasNext) {
                    if (!assign_object_from_value(jaileval, tokenizer, obj)) throw jail_error();
                }
                if (!tokenizer.end()) throw jail_error();
                return obj;
            case 'buffer':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                var obj = toJailObject(jaileval, index, jail_buffer);
                if (tokenizer.next(',')) {
                    var value = resolvedBuffers.get(obj);
                    if (!value) throw jail_error();
                    if (!assign_object_from_value(jaileval, tokenizer, value)) throw jail_error();
                    return value;
                }
                if (!tokenizer.end()) throw jail_error();
                return obj;
            case 'sharedbuffer':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) throw jail_error();
                var obj = toJailObject(jaileval, index, jail_buffer);
                var value = resolvedBuffers.get(obj);
                if (!value) throw jail_error();
                if (tokenizer.next(',')) {
                    if (!assign_object_from_value(jaileval, tokenizer, value)) throw jail_error();
                }
                if (!tokenizer.end()) throw jail_error();
                if (!(value instanceof ArrayBuffer) && (!self.SharedArrayBuffer || !(data instanceof SharedArrayBuffer))) throw jail_error();
                var v = new SharedArrayBuffer(value.byteLength);
                var y = new Uint8Array(v);
                var z = new Uint8Array(value);
                for (var i = 0; i < y.length; i++) {
                    y[i] = z[i];
                }
                resolvedBuffers.set(obj, v);
                return v;
            case 'set':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) {
                    var arr = toValue(jaileval, tokenizer);
                    if (arr == null || !(arr instanceof Array)) throw jail_error();
                    var set = new Set(arr);
                    if (tokenizer.next(',')) {
                        if (!assign_object_from_value(jaileval, tokenizer, set)) throw jail_error();
                    }
                    return set;
                } else {
                    if (index in jaileval.objs) return jaileval.objs[index];
                    else return (new JailSet(wrapper_secret, jaileval, index)).object;
                }
            case 'map':
                if (!tokenizer.startCall()) throw jail_error();
                var index = tokenizer.number();
                if (index == null) {
                    var arr = toValue(jaileval, tokenizer);
                    if (arr == null || !(arr instanceof Array)) throw jail_error();
                    var map = new Map();
                    for (var item of arr) {
                        if (item == null || !(item instanceof Array)) throw jail_error();
                        map.set(item[0], item[1]);
                    }
                    if (tokenizer.next(',')) {
                        if (!assign_object_from_value(jaileval, tokenizer, map)) throw jail_error();
                    }
                    return map;
                } else {
                    if (index in jaileval.objs) return jaileval.objs[index];
                    else return (new JailMap(wrapper_secret, jaileval, index)).object;
                }
            case 'error':
                if (!tokenizer.startCall()) throw jail_error();
                var type = tokenizer.string();
                if (!tokenizer.next(',')) throw jail_error();
                var name = tokenizer.string();
                if (!tokenizer.next(',')) throw jail_error();
                var message = tokenizer.string();
                if (!tokenizer.next(',')) throw jail_error();
                var stack = tokenizer.string();
                var errors = { EvalError, RangeError, ReferenceError, SyntaxError, TypeError, AggregateError: self.AggregateError, InternalError: self.InternalError };
                var cls = errors[type];
                if (!cls) cls = Error;
                if (tokenizer.next(',')) {
                    var object_index = tokenizer.number();
                    var sub = new cls(message);
                    sub.name = name;
                    sub.stack = stack;
                    sub.toString = () => stack;
                    if (object_index == null) {
                        if (!assign_object_from_value(jaileval, tokenizer, sub)) throw jail_error();
                        if (!tokenizer.end()) throw jail_error();
                        return new JailError(sub, message, sub);
                    }
                    if (!tokenizer.end()) throw jail_error();
                    var err = new JailError(sub, message);
                    err.obj = toJailObject(jaileval, object_index, err);
                    return err;
                } else throw jail_error();
            default:
                throw jail_error();
        }
    }

    /**
     * Returns a message that can be sended to jail from a main JS value.
     * If the value is a JailObject, the jailed object (for that id) is returned.
     * If the value is a JailPromise, the promise (from JailPromise) is returned.
     * 
     * @param {Function} jaileval the session for jail.
     * @param {*} value the value to convert
     */
    var fromValue = function (jaileval, value, frozen) {
        if (typeof value == 'undefined') {
            return 'this.root.undefined';
        } else if (value == null) {
            return 'null';
        } else if (typeof value == 'number') {
            if (isNaN(value)) {
                return 'this.root.NaN';
            } else if (value == Infinity) {
                return 'this.root.Infinity'
            } else if (value == -Infinity) {
                return '(-this.root.Infinity)'
            } else {
                return '(' + String(value) + ')';
            }
        } else if (typeof value == 'bigint') {
            return 'this.root.BigInt(' + String(value) + ')';
        } else if (typeof value == 'string') {
            return '(' + JSON.stringify(value) + ')';
        } else if (typeof value == 'symbol') {
            var index;
            if (value in jaileval.symbols) {
                index = jaileval.symbols[value];
            } else {
                index = -(jaileval.objscount++);
                jaileval.symbols[value] = index;
                jaileval.symbol_index[index] = value;
            }
            return '(this.symbol(' + String(index) + ',' + JSON.stringify(value.description) + '))';
        } else if (typeof value == 'function') {
            var index;
            var objskeys = Object.keys(jaileval.funcs);
            var objslen = objskeys.length;
            for (var i = 0; i < objslen; i++) {
                var key = objskeys[i];
                if (key == undefined) continue;
                if (jaileval.funcs[key] === value) index = key;
            }
            if (index == null) index = -(jaileval.objscount++);
            jaileval.funcs[index] = value;
            return '(this.wrap("function",' + String(index) + ',{name:' + JSON.stringify(value.name) + '}))';
        } else if (typeof value == 'boolean') {
            return value ? 'true' : 'false';
        } else if (
            self.Uint8Array &&
            (
                (self.ArrayBuffer && value instanceof ArrayBuffer) ||
                value instanceof Uint8Array ||
                value instanceof Uint16Array ||
                value instanceof Uint32Array ||
                value instanceof Int8Array ||
                value instanceof Int16Array ||
                value instanceof Int32Array ||
                value instanceof Float32Array ||
                value instanceof Float64Array ||
                (self.BigUint64Array && value instanceof BigUint64Array) ||
                (self.SharedArrayBuffer && value instanceof SharedArrayBuffer)
            )) {

            //it is not allowed to post SharedArrayBuffers using postMessage if certain HTTP headers are not set
            //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes
            if (!self.crossOriginIsolated && self.SharedArrayBuffer && value instanceof self.SharedArrayBuffer) frozen = true;
            if (frozen) {
                var types = {
                    Uint8Array: self.Uint8Array,
                    Int8Array: self.Int8Array,
                    Uint16Array: self.Uint16Array,
                    Int16Array: self.Int16Array,
                    Uint32Array: self.Uint32Array,
                    Int32Array: self.Int32Array,
                    BigUint64Array: self.BigUint64Array,
                    BigInt64Array: self.BigInt64Array,
                    Float32Array: self.Float32Array,
                    Float64Array: self.Float64Array
                };
                var name = (self.SharedArrayBuffer && value instanceof SharedArrayBuffer) ? "SharedArrayBuffer" : ((self.ArrayBuffer && value instanceof ArrayBuffer) ? "ArrayBuffer" : null)
                if (!name) {
                    for (var key in types) {
                        if (types[key] && value instanceof types[key]) {
                            name = key;
                        }
                    }
                }
                if (!name) throw new TypeError("Unknown binary array");
                return "this.fromTypedArray(" + JSON.stringify(name) + "," + JSON.stringify(value.byteLength) + "," + JSON.stringify(binToCompressedText(value)) + ")";
            } else {
                var index = -(jaileval.objscount++);
                jaileval.worker.postMessage({ index, value });
                var obj = toJailObject(jaileval, index, jail_buffer);
                resolvedBuffers.set(obj, value);
                return "this.objs[" + index + "]";
            }
        } else if (value instanceof JailSynchronousFunction) {
            if (!jaileval.data_buffer) throw new TypeError("First enable synchronous API before adding synchronous functions");
            var index;
            var objskeys = Object.keys(jaileval.funcs);
            var objslen = objskeys.length;
            for (var i = 0; i < objslen; i++) {
                var key = objskeys[i];
                if (key == undefined) continue;
                if (jaileval.funcs[key] === value) index = value;
            }
            if (index == null) index = -(jaileval.objscount++);
            jaileval.funcs[index] = value;
            return '(this.wrap("syncfunction",' + String(index) + ',{name:' + JSON.stringify(value.value.name) + '}))';
        } else if(value instanceof JailVoidFunction) {
            var index;
            var objskeys = Object.keys(jaileval.funcs);
            var objslen = objskeys.length;
            for (var i = 0; i < objslen; i++) {
                var key = objskeys[i];
                if (key == undefined) continue;
                if (jaileval.funcs[key] === value) index = value;
            }
            if (index == null) index = -(jaileval.objscount++);
            jaileval.funcs[index] = value;
            return '(this.wrap("voidfunction",' + String(index) + ',{name:' + JSON.stringify(value.value.name) + '}))';
        } else if (value instanceof Promise || value instanceof JailPromise) {
            if (value instanceof JailPromise) value = value.value;
            if (index in jaileval.promises) {
                return '(this.wrap("promise", ' + String(index) + '))';
            }
            var index = -(jaileval.objscount++);
            jaileval.promises[index] = new JailPromise(value);
            return '(this.wrap("promise", ' + String(index) + '))';
        } else if (value instanceof String) {
            return '(new this.root.StringType(' + JSON.stringify(String(value)) + '))';
        } else if (value instanceof Number) {
            return '(new this.root.Number(' + String(value) + '))';
        } else if (self.BigInt && value instanceof BigInt) {
            return '(this.root.Object(this.root.BigInt(' + String(value) + ')))';
        } else if (value instanceof Symbol) {
            var index;
            value = value.valueOf();
            if (value in jaileval.symbols) {
                index = jaileval.symbols[value];
            } else {
                index = -(jaileval.objscount++);
                jaileval.symbols[value] = index;
                jaileval.symbol_index[index] = value;
            }
            return '(this.root.Object(this.symbol(' + String(index) + ',' + JSON.stringify(value.description) + ')))';
        } else if (value instanceof Boolean) {
            return '(new this.root.Boolean(' + (value.valueOf() ? 'true' : 'false') + '))';
        } else if (value instanceof Array) {
            var length = value.length;
            var str = '[';
            for (var i = 0; i < length; i++) {
                if (i > 0) str += ',';
                str += fromValue(jaileval, value[i]);
            }
            return '(' + str + '])';
        } else if (value instanceof JailObject) {
            if (jaileval !== value[jail_eval]) throw new TypeError("Cannot pass a JailObject from an another jail");
            return '(this.objs[' + String(value[jail_index]) + '])';
        } else if (value instanceof JailMap || value instanceof JailSet) {
            return fromValue(jaileval, value.object);
        } else if (value instanceof Error) {
            var type = 'Error';
            var errors = { EvalError, RangeError, ReferenceError, SyntaxError, TypeError, AggregateError: self.AggregateError, InternalError: self.InternalError };
            for (var cls in errors) {
                try {
                    if (value instanceof errors[cls]) {
                        type = cls;
                    }
                } catch (ex) { }
            }
            return '(this.wrap("error", {type:' + JSON.stringify(type) + ',name:' + JSON.stringify(value.name) + ',message:' + JSON.stringify(value.message) + ',stack:' + JSON.stringify(value.stack) + '}))';
        } else if (value instanceof Set) {
            return '(new this.root.Set(' + fromValue(jaileval, [...value]) + ')';
        } else if (value instanceof Map) {
            var keys = [...value.keys()];
            var arr = [];
            for (var key of keys) {
                arr.push([key, value.get(key)]);
            }
            return '(new this.root.Map(' + fromValue(jaileval, arr) + '))';
        } else if (value instanceof Date) {
            return '(new this.root.Date(' + value.getTime() + '))';
        } else {
            var keys = Object.keys(value);
            var length = keys.length;
            var str = '{';
            for (var i = 0; i < length; i++) {
                var key = keys[i];
                if (key == undefined) continue;
                var v = value[key];
                if (i > 0) str += ',';
                str += JSON.stringify(key) + ':' + fromValue(jaileval, v);
            }
            return '(' + str + '})';
        }
    }

    /**
     * This returns a message, that returns a property (as lvalue) from 'obj: JailObject' with 'name' as location.
     * @param {JailObject} obj the jailed object. 
     * @param {Array|string|symbol|undefined} name the location of the property in obj
     */
    var getFieldLocation = function (obj, name) {
        var str;
        if (name == undefined || name == '') {
            str = 'this.objs[' + String(obj[jail_index]) + ']';
        } else {
            if (name instanceof Array) {
                str = 'this.objs[' + String(obj[jail_index]) + ']';
                for (var i = 0; i < name.length; i++) {
                    var val = name[i];
                    if (typeof val != 'string' && !(val instanceof String) && typeof val != 'symbol') {
                        throw new TypeError('Array member needs to be a string or symbol');
                    }
                    str += '[' + fromValue(obj[jail_eval], val) + ']';
                }
            } else {
                str = 'this.objs[' + String(obj[jail_index]) + '][' + fromValue(obj[jail_eval], name) + ']';
            }
        }
        return str;
    }
    /**
     * This object represents a JS Map in the jailed environment.
     * You can manipulate that map asynchronously with functions from this class.
     * 
     * This class is always linked with a JailObject (.object)
     * You can obtain the JailMap from a JailObject with the valueOf()
     */
    self.JailMap = class {
        constructor(secret, j_eval, index) {
            if (!(secret === wrapper_secret))
                throw new Error("You may not create a JailObject instance.");
            Object.defineProperty(this, jail_eval, { configurable: false, enumerable: false, writable: false, value: j_eval });
            Object.defineProperty(this, jail_index, { configurable: false, enumerable: false, writable: false, value: index });
            Object.defineProperty(this, 'jail', { configurable: false, enumerable: false, writable: false, value: j_eval.control })
            Object.defineProperty(this, "object", { configurable: false, enumerable: false, writable: false, value: toJailObject(j_eval, index, this) });
        }

        /**
         * Get a value by its key
         * @param {*} key The key that identifies the value 
         * @returns {Promise<*>} The value
         */
        get(key) {
            return this[jail_eval]('return this.util.map.get(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval, key]) + '));');
        }

        /**
         * Add a new value to the map, identified by a key
         * @param {*} key The key for the new value
         * @param {*} value The new value
         * @returns {Promise<JailObject>} The map (as JailObject)
         */
        set(key, value) {
            return this[jail_eval]('return this.util.map.set(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval], key) + '),(' + fromValue(this[jail_eval], value) + '));');
        }

        /**
         * Checks if the map has a key
         * @param {*} key the key
         * @returns {Promise<boolean>} If the map has this key
         */
        has(key) {
            return this[jail_eval]('return this.util.map.has(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval], key) + '));');
        }

        /**
         * Deletes a value (identified by a key) from the map.
         * @param {*} key the key (with value) to remove
         * @returns {Promise<boolean>} if the key is removed
         */
        delete(key) {
            return this[jail_eval]('return this.util.map.delete(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval], key) + '));');
        }

        /**
         * Get an array of all keys in this map
         * @returns {Promise<Array>} An array with all keys
         */
        keys() {
            return this[jail_eval]('return this.static(this.util.map.keys(this.objs[' + String(this[jail_index]) + ']), false);');
        }

        /**
         * Get an array of all values in this map
         * @returns {Promise<Array>} An array with all values
         */
        values() {
            return this[jail_eval]('return this.static(this.util.map.values(this.objs[' + String(this[jail_index]) + ']), false);');
        }

        /**
         * Get an array of all entries (inner array [key, value]) in this map
         * @returns {Promise<[any, any][]>} An array with the entries. each entry is an array with two items: the key and the value
         */
        entries() {
            return this[jail_eval]('return this.static(this.util.mapArray(this.util.map.entries(this.objs[' + String(this[jail_index]) + ']), x => this.static(x, false)), false);');
        }

        /**
         * Get a string representation for this Map
         * @returns {Promise<string>} a human readable string
         */
        objectToString() {
            return this.object.objectToString();
        }
    };
    /**
     * This class represents a JS Set in the jailed environment.
     * You can manipulate asynchronously with functions from this class
     * 
     * This class is always linked with a JailObject (.object)
     * You can obtain a JailSet from a JailObject with the valueOf()
     */
    self.JailSet = class {
        constructor(secret, j_eval, index) {
            if (!(secret === wrapper_secret))
                throw new Error("You may not create a JailObject instance.");
            Object.defineProperty(this, jail_eval, { configurable: false, enumerable: false, writable: false, value: j_eval });
            Object.defineProperty(this, jail_index, { configurable: false, enumerable: false, writable: false, value: index });
            Object.defineProperty(this, 'jail', { configurable: false, enumerable: false, writable: false, value: j_eval.control })
            Object.defineProperty(this, "object", { configurable: false, enumerable: false, writable: false, value: toJailObject(j_eval, index, this) });
        }

        /**
         * Add a value to this set, if it does not exist
         * @param {*} value the value to add
         * @returns {Promise<JailObject>} this set as a JailObject 
         */
        add(value) {
            return this[jail_eval]('return this.util.set.add(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval], value) + '));');
        }

        /**
         * Checks if this set has a value
         * @param {*} value the value to check
         * @returns {Promise<boolean>} if this set has that value
         */
        has(value) {
            return this[jail_eval]('return this.util.set.has(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval], value) + '));');
        }

        /**
         * Deletes a value from this set
         * @param {*} value the value to remove
         * @returns {Promise<boolean>} if the value is removed 
         */
        delete(value) {
            return this[jail_eval]('return this.util.set.delete(this.objs[' + String(this[jail_index]) + '],(' + fromValue(this[jail_eval], value) + '));');
        }

        /**
         * Get an array with all the values
         * @returns {Promise<Array>} An array with all the values in this set
         */
        values() {
            return this[jail_eval]('return this.static(this.util.set.values(this.objs[' + String(this[jail_index]) + ']), false);');
        }

        /**
         * Get a string representation for this Set
         * @returns {Promise<string>} a human readable string
         */
        objectToString() {
            return this.object.objectToString();
        }
    };
    self.JailObject = class {
        constructor(secret, j_eval, index, primitive_value) {
            if (!(secret === wrapper_secret))
                throw new Error("You may not create a JailObject instance.");
            Object.defineProperty(this, jail_eval, { configurable: false, enumerable: false, writable: false, value: j_eval });
            Object.defineProperty(this, jail_index, { configurable: false, enumerable: false, writable: false, value: index });
            Object.defineProperty(this, jail_primitive, { configurable: false, enumerable: false, writable: false, value: primitive_value == undefined ? null : primitive_value });
            Object.defineProperty(this, 'jail', { configurable: false, enumerable: false, writable: false, value: j_eval.control })
            Object.seal(this);
        }

        /**
         * Get a value from a field
         * @param {string|symbol|Array|undefined} name 
         * @returns {Promise}
         */
        get(name) {
            return this[jail_eval]('return ' + getFieldLocation(this, name) + ';')
        }

        /**
         * Sets an value to this object, name may not be empty.
         * @param {string|symbol|Array|undefined} name 
         * @param {*} value 
         * @returns {Promise}
         */
        set(name, value) {
            if (name == null || name == '' || (name instanceof Array && name.length == 0)) throw new TypeError("The name can't be empty for set.");
            var str = 'return ' + getFieldLocation(this, name);
            str += ' = ' + fromValue(this[jail_eval], value) + ';';
            return this[jail_eval](str);
        }

        /**
         * Delete a field from this object, name may not be empty.
         * @param {string|symbol|Array} name 
         * @returns {Promise<boolean>}
         */
        delete(name) {
            if (name == null || name == '' || (name instanceof Array && name.length == 0)) throw new TypeError("The name can't be empty for delete.");
            return this[jail_eval]('return delete ' + getFieldLocation(this, name) + ';')
        }


        /**
         * Remove this object from the object list, after deletion you cannot use it anymore
         * 
         * CAUTION! if you delete things like promises or functions, there is a chance that errors will be thrown when invoked.
         * @returns {Promise<boolean>} true if deleted, false if not
         */
        remove() {
            return this[jail_eval]('return delete this.objs[' + this[jail_index] + '];').then(x => x ? delete this[jail_eval].objs[this[jail_index]] : false);
        }

        /**
         * Returns true if the field is in this object.
         * @param {string|symbol|Array} name
         * @returns {Promise<boolean>}
         */
        has(name) {
            var loc = [];
            if (name == null || name == '' || (name instanceof Array && name.length == 0)) return this[jail_eval](String(this[jail_index]) + ' in this.objs');
            if (name instanceof Array) {
                loc = name;
                name = name.pop();
            }
            return this[jail_eval]('return ' + fromValue(this[jail_eval], name) + ' in ' + getFieldLocation(this, loc) + ';')
        }

        /**
         * Invoke a function from an field or invoke this object (as function).
         * The this is bounded automatically if it is not given:
         * * If you invoke without a name (so you invoke this object), this refers to the global object.
         * * If you invoke with a name with 1 segment, this refers to 'this' JailObject.
         * * If you invoke with a name with more then 1 segment, this refers to the property of the previous segment in the name
         * 
         * Signatures (checked in order):
         * invoke(name as symbol|string, args)
         * invoke(name as symbol|string)
         * invoke(bind, args, voided)
         * invoke(bind, args)
         * invoke(args)
         * invoke(name as symbol|string|Array, bind, args, voided)
         * invoke(name as symbol|string|Array, bind, args)
         * 
         * name can be an Array, symbol or string
         * args can be an Array
         * bind can be anything
         * 
         * symbol can also be the object Symbol,
         * and string can also be the object String
         * 
         * 
         * @param {string|symbol|Array|undefined} name the name of the function
         * @param {JailObject|object|null|undefined} bind the this for the function to invoke. Normally it is the obejct itself. (null/undefined to set it to auto)
         * @param {Array|undefined} args the arguments array
         * @param {boolean} voided If you do not care about a return value
         */
        invoke(name, bind, args, voided) {
            if(typeof args == 'boolean') {
                voided = args;
                args = undefined;
            }
            var thisLocation = '';
            if (args == undefined) {
                if (typeof name == 'string' || typeof name == 'symbol' || name instanceof String || name instanceof Symbol) {
                    args = bind;
                    bind = null;
                } else {
                    if (bind != undefined) {
                        args = bind;
                        bind = name;
                        name = '';
                    } else {
                        args = name;
                        bind = null;
                        name = '';
                    }
                }
            }
            if (bind == undefined) bind = null;
            if (args == undefined || !(args instanceof Array)) {
                args = [];
            }
            if (name instanceof String || name instanceof Symbol) name = name.valueOf();
            if (name instanceof Array) {
                thisLocation = Object.assign([], name);
                if (thisLocation.length > 1) {
                    thisLocation.pop();
                } else thisLocation = '';
            }
            var str = '"' + (voided ? "callvoid" : "call") + '"; return {function: ' + getFieldLocation(this, name) + ',args:[';
            for (var i = 0; i < args.length; i++) {
                if (i > 0) str += ',';
                str += '(' + fromValue(this[jail_eval], args[i]) + ')';
            }
            str += ']';
            if (bind != null) {
                str += ',bind:(' + fromValue(this[jail_eval], bind) + ')';
            } else {
                if (name == '' || (name instanceof Array && name.length < 1)) {
                    str += ',bind:this.self'
                } else {
                    str += ',bind:(' + getFieldLocation(this, thisLocation) + ')';
                }
            }
            return this[jail_eval](str + '};');
        }

        /**
         * Define a property on this object. (name may not be an array.)
         * @param {string|symbol|number} name 
         * @param {object} descriptor 
         */
        defineProperty(name, descriptor) {
            return this[jail_eval]('return this.util.defineProperty(this.objs[' + String(this[jail_index]) + '], ' + fromValue(this[jail_eval], name) + ', ' + fromValue(this[jail_eval], descriptor) + ');')
        }

        /**
         * Get the property descriptor from the property named 'name'. (name may not be an array.)
         * @param {string|symbol} name 
         * @returns {Promise<Array>}
         */
        getOwnPropertyDescriptor(name) {
            return this[jail_eval]('return this.static(this.util.getOwnPropertyDescriptor(this.objs[' + String(this[jail_index]) + '],' + fromValue(this[jail_eval], name) + '), false);')
        }

        /**
         * Get all keys (enumerable properties) from this object
         * @returns {Promise<Array<string|number>>}
         */
        keys() {
            return this[jail_eval]('return this.static(this.util.keys(this.objs[' + String(this[jail_index]) + ']));')
        }

        /**
         * Get all property names from this object
         * @returns {Promise<Array<string|number>>}
         */
        getOwnPropertyNames() {
            return this[jail_eval]('return this.static(this.util.getOwnPropertyNames(this.objs[' + String(this[jail_index]) + ']));')
        }

        /**
         * Get all property symbols from this object
         * @returns {Promise<Array<symbol>>}
         */
        getOwnPropertySymbols() {
            return this[jail_eval]('return this.static(this.util.getOwnPropertySymbols(this.objs[' + String(this[jail_index]) + ']));')
        }



        /**
         * Freeze this object, no edits can be perfomed anymore on the object. The ultimate way of lockdown.
         * @returns {Promise}
         */
        freeze() {
            return this[jail_eval]('return this.util.freezeObject(this.objs[' + String(this[jail_index]) + ']);')
        }

        /**
         * Returns true if this object is frozen.
         * @return {Promise<boolean>}
         */
        isFrozen() {
            return this[jail_eval]('return this.util.ObjectIsFrozen(this.objs[' + String(this[jail_index]) + ']);')
        }

        /**
         * Sealing a object means that no other properties can be added, change descriptors, or deleted.
         * @returns {Promise}
         */
        seal() {
            return this[jail_eval]('return this.util.ObjectSeal(this.objs[' + String(this[jail_index]) + ']);')
        }

        /**
         * Returns truw if this object is sealed
         * @returns {Promise<boolean>}
         */
        isSealed() {
            return this[jail_eval]('return this.util.ObjectIsSealed(this.objs[' + String(this[jail_index]) + ']);')
        }


        /**
         * Returns true if you can add properties to this object.
         * @returns {Promise<boolean>}
         */
        isExtensible() {
            return this[jail_eval]('return this.util.ObjectIsExtensible(this.objs[' + String(this[jail_index]) + ']);')
        }

        /*
        * Return true if this (as a promise!) is an EventTarget
        * @returns {Promise<boolean>}
        */
        isEventTarget() {
            return this[jail_eval]('return this.root.EventTarget == null ? false : (this.objs[' + String(this[jail_index]) + '] instanceof this.root.EventTarget);');
        }

        /*
        * Returns true if this (as a promise!) is an EventTarget
        * @returns {Promise<boolean>}
        */
        isEvent() {
            return this[jail_eval]('return this.root.Event == null ? false : (this.objs[' + String(this[jail_index]) + '] instanceof this.root.Event);');
        }

        /*
        * Dispatch an event on this EventTarget
        * @param {string|JailObject|Event} ev The event(name) to dispatch
        * @param {object|JailObject} data A object with some data for the Event (will be assigned to the Event). (ev must be a string)
        * @returns {Promise<boolean>} see EventTarget.prototype.dispatchEvent
        */
        dispatchEvent(ev, data) {
            try {
                var str = '';
                if (typeof ev == 'object' && ev != null && Event && ev instanceof Event) {
                    data = ev;
                    ev = ev.type;
                }
                if (typeof ev == 'string') {
                    str = 'new this.root.Event(' + JSON.stringify(ev) + ')';
                    if (data) {
                        str = 'this.util.ObjectAssign(new this.root.Event(' + JSON.stringify(ev) + '), (' + fromValue(this[jail_eval], data) + '))';
                    } else {
                        str = 'new this.root.Event(' + JSON.stringify(ev) + ')';
                    }
                } else if (ev instanceof JailObject) {
                    if (ev[jail_eval] !== this[jail_eval]) throw new TypeError("Cannot pass a JailObject from a different jail");
                    str = 'this.objs[' + ev[jail_index] + ']';
                } else throw new TypeError("Expects ev to be a string/Event (and data, optional, a plain object) OR ev to be a JailObject (of an Event)");
                return this[jail_eval]('return this.util.dispatchEvent(this.objs[' + String(this[jail_index]) + '], ' + str + ')');
            } catch (ex) {
                return Promise.reject(ex);
            }
        }

        /**
         * This function will prevent any new properties to be created on this object.
         * @returns {Promise}
         */
        preventExtensions() {
            return this[jail_eval]('return this.util.ObjectPreventExtensions(this.objs[' + String(this[jail_index]) + ']);')
        }

        /**
         * Resolve will copy the object (that lives in the jailed context) to the main context.
         * 
         * This happens:
         * * Primitive values will stay the same.
         * * Primitive objects wil be converted to new created primitive objects in the main context.
         * * Wrapper functions in the main context will be created for the functions in the jailed context.
         * * If this object is the root object, this object is returned.
         * * Objects/Arrays will be deeply copied to the main context
         * ** You can pass any value from the main context to the function, that value will be copied to the jailed context
         * ** If you pass a JailObject to the function, the wrapped value from the jailed context (where the JailObject wraps to) will be passed
         *
         * Remember that the returned value (except for functions) are not linked to the jailed context anymore.
         * 
         * @param {boolean|undefined} deep If we need to deeply copy objects and arrays. Defaults to true
         */
        resolve(deep) {
            var r = this[jail_primitive] === jail_buffer ? null : this.valueOf();
            if (r != null && !(r instanceof JailSet) && !(r instanceof JailMap)) {
                if (r instanceof Promise) return Promise.resolve(new JailPromise(r));
                else if (typeof r == 'object' || typeof r == 'function') return Promise.resolve(r);
                else return Promise.resolve(Object(r));
            }
            if (deep == undefined) deep = true;
            return this[jail_eval]('return this.static(this.objs[' + String(this[jail_index]) + '],' + (deep ? 'true' : 'false') + ');');
        }

        /**
         * Check if this object is instanceof an other object 'other'
         * @param {Promise<Boolean>} other 
         */
        instanceOf(other) {
            return this[jail_eval]('return this.objs[' + String(this[jail_index]) + '] instanceof (' + fromValue(this[jail_eval], other) + ');');
        }

        /**
         * Check if this object is a function.
         * @returns {boolean}
         */
        isFunction() {
            return this[jail_primitive] === jail_function;
        }

        /**
         * Check if this object is an array
         * @returns {boolean}
         */
        isArray() {
            return this[jail_primitive] === jail_array;
        }
        isBuffer() {
            return this[jail_primitive] === jail_buffer;
        }
        isSet() {
            return this[jail_primitive] != null && this[jail_primitive] instanceof JailSet;
        }

        isMap() {
            return this[jail_primitive] != null && this[jail_primitive] instanceof JailMap;
        }

        /**
         * Check if this object equals an other object
         * @param {*} other 
         * @returns {Promise<Boolean>}
         */
        equals(other) {
            return this[jail_eval]('return this.objs[' + String(this[jail_index]) + '] == ' + fromValue(this[jail_eval], other) + ';')
        }

        /**
         * Check if this object equals an other object
         * @param {*} other 
         * @returns {Promise<Boolean>}
         */
        equalsStrict(other) {
            return this[jail_eval]('return this.objs[' + String(this[jail_index]) + '] === ' + fromValue(this[jail_eval], other) + ';')
        }

        /**
         * Get the length of this array or string.
         * 
         * If the value type is an Array, the length of the array is returned.
         * If the value type is an String, the length of the string is returned
         * Otherwise the object is tried to be converted to an array and the length of that is returned.
         * @returns {Promise<number>} the length of this object
         */
        length() {
            var value = this[jail_primitive];
            if (value === jail_array) {
                return this[jail_eval]('return this.util.arrayLength(this.objs[' + String(this[jail_index]) + ']);');
            } else if (value === jail_function) return Promise.reject(new TypeError("jailed functions don't have lengths"));
            else if (typeof value == 'string') return value.length;
            else return this[jail_eval]('return this.util.arrayLength(this.util.toArray(this.objs[' + String(this[jail_index]) + ']));');
        }
        /**
         * Returns the primitive value of this object, returns null if this object
         * doesn't have a primitive value.
         * @returns {boolean|string|symbol|number|Promise|Function|Error|undefined}
         */
        valueOf(funcVoided) {
            if (this[jail_primitive] === jail_function) {
                var index = this[jail_index];
                var jaileval = this[jail_eval];
                var me = this;
                var ret;
                if (index in jaileval.funcs) {
                    var func = jaileval.funcs[index];
                    if (func instanceof JailSynchronousFunction) func = func.value;
                    if(func instanceof JailVoidFunction || funcVoided) {
                        ret = function() {
                            try {
                                func.apply(null, Array.prototype.slice.call(arguments));
                                return Promise.resolve(undefined);
                            } catch (ex) {
                                if (ex instanceof Promise) ex = new JailPromise(ex);
                                return Promise.reject(ex);
                            }
                        };
                    } else {
                        ret = function () {
                            try {
                                var result = func.apply(null, Array.prototype.slice.call(arguments));
                                if (result instanceof Promise) result = new JailPromise(result);
                                return Promise.resolve(result);
                            } catch (ex) {
                                if (ex instanceof Promise) ex = new JailPromise(ex);
                                return Promise.reject(ex);
                            }
                        };
                    }
                } else {
                    ret = function () {
                        //we will NOT expose our this
                        return me.invoke('', jaileval.control.root, Array.prototype.slice.call(arguments), funcVoided);
                    };
                }
                ret.wrapper = this;
                return ret;
            } else if (this[jail_primitive] === jail_array) {
                return null;
            } else if (this[jail_primitive] === jail_buffer) {
                return resolvedBuffers.get(this);
            } else {
                var val = this[jail_primitive];
                if (val instanceof JailError && val.cause) val = val.cause;
                return val;
            }
        }

        getJailError() {
            var val = this[jail_primitive];
            if (!val) return null;
            if (val instanceof JailError) return val;
            if (!(val instanceof Error)) return null;
            return new JailError(val, val.message, this);
        }
        /**
         * Returns true if this object is the root object
         * @returns {boolean}
         */
        isRoot() {
            return this[jail_index] == 0;
        }

        /**
         * Get the prototype of this object
         * @returns {Promise<JailObject>}
         */
        getPrototype() {
            return this[jail_eval]('return this.util.getPrototypeOf(this.objs[' + String(this[jail_index]) + '])');
        }

        /**
         * Sets the prototype of this object
         * @returns {Promise<JailObject>}
         */
        setPrototype(prototype) {
            return this[jail_eval]('return this.util.setPrototypeOf(this.objs[' + String(this[jail_index]) + '], ' + fromValue(this[jail_eval], prototype) + ')');
        }


        /**
         * Get a human-readable string representation of this JailObject
         * 
         * @returns {Promise<String>} the string that represents this object. It can be logged
         */
        objectToString() {
            return JailJS.variableToString(this);
        }

    };

    var cachedWorkerCode = null;
    var xhr = null;
    var xhrResolvers = [];
    var jails = [];

    self.JailJS = class {
        /**
         * Construct a new Jailed environment. It will be created immediately.
         * You do not have to wait before it is ready (or you can use .onReady() that returns a Promise)
         * 
         * You can get the global of the jailed environment with .root
         */
        constructor(secret, parent) {
            var isChild = false;
            if(secret === wrapper_secret) isChild = true;
            parent = (isChild ? parent : null);
            if(!parent) isChild = false;

            var value_callbacks = [];
            var do_terminate;
            var me = this;
            var on_terminate = new Promise(function (resolve, reject) {
                var terminated = false;
                do_terminate = function (err) {
                    if (!terminated) {
                        terminated = true;
                        var ind = jails.indexOf(me);
                        if(ind >= 0) jails.splice(ind, 1);
                        //also terminate ALL the children
                        for(var child of jaileval.children) {
                            child[jail_eval].terminate();
                        }
                        if (typeof err != 'object' && err != undefined) err = new JailTerminatedError(err);
                        Object.defineProperty(me, 'is_terminated', { configurable: false, enumerable: true, writable: false, value: true });
                        if (me[jail_eval].worker) me[jail_eval].worker.terminate();
                        var callbacks = me[jail_eval].value_callbacks;
                        me[jail_eval].err = err == undefined ? new JailTerminatedError("The jail is gracefully terminated, can't perform any actions.") : err;
                        if (err == undefined) err = me[jail_eval].err;
                        if (jaileval.empty_callback != null) jaileval.empty_callback.reject(err);
                        while (callbacks.length > 0) {
                            callbacks.pop().reject(err)
                        }
                        //free indexes from JS
                        jaileval.symbols = {};
                        jaileval.symbol_index = {};
                        jaileval.objs = {};
                        jaileval.funcs = {};
                        jaileval.promises = {};
                        resolve();
                    }
                }
            });

            var worker;
            var cachedMsg = [];
            var postBuff = null;

            function gotWorkerCode() {
                var asWebWorker = false;
                if(!worker) {
                    asWebWorker = true;
                    //this 'boot' script of the worker will receive one message (the jailed.js) code and evals that.
                    worker = new Worker("data:text/javascript," + encodeURIComponent("//# sourceURL=boot\nthis.onmessage=e=>(1,eval)(e.data);"));
                    worker.postMessage(cachedWorkerCode);
                }
                jaileval.worker = worker;
                for (var msg of cachedMsg) worker.postMessage(msg);
                cachedMsg = null;
                if(asWebWorker) {
                    var messageListener = null;
                    worker.setMessageListener = function(listener) {
                        messageListener = listener;
                    };
                    worker.addEventListener('message', e => messageListener && messageListener(e.data));
                } else {
                    worker.setOnTerminateListener(() => {
                        if(!me.is_terminated) jaileval.terminate();
                    });
                }

                worker.setMessageListener(function(message) {
                    //debug
                    //console.debug("< " + message);
                    if (message == 'next') {
                        if (!jaileval.data_buffer || !postBuff) {
                            var err = new Error("Something went wrong by returning a synchronous function.");
                            me.forceTerminate(err);
                            throw err;
                        }
                        var arr = new Int32Array(jaileval.data_buffer);
                        arr[1] = postBuff.byteLength;
                        var txt = new Uint8Array(jaileval.data_buffer);
                        var block = jaileval.data_buffer.byteLength - 8;
                        var cpy = postBuff.byteLength;
                        if (cpy > block) cpy = block;
                        for (var i = 0; i < cpy; i++) {
                            txt[i + 8] = postBuff[i];
                        }
                        jaileval.buffer_state++;
                        jaileval.buffer_state = jaileval.buffer_state % 1024;
                        arr[0] = jaileval.buffer_state;
                        Atomics.notify(arr, 0);
                        if (postBuff.byteLength > block) postBuff = postBuff.slice(block);
                        else postBuff = null;
                        return;
                    }
                    if (typeof message == 'object' && message.index && message.value) {
                        if (message.buffer) {
                            resolvedBuffers.set(toJailObject(jaileval, message.index, jail_buffer), message.value);
                        } else {
                            jaileval.objs[message.index] = message.value;
                        }
                        return;
                    }
                    var reader = new Tokenizer(message);
                    var func = reader.name();
                    if (func == null) throw jail_error();
                    func = func.toLowerCase();
                    switch (func) {
                        case 'return':
                            if (!reader.startCall()) throw jail_error();
                            if (value_callbacks.length < 1) return;
                            jaileval.next_callback().resolve(toValue(jaileval, reader));
                            break;
                        case 'returnerror':
                            if (!reader.startCall()) throw jail_error();
                            if (value_callbacks.length < 1) return;
                            jaileval.next_callback().reject(toValue(jaileval, reader));
                            break;
                        case 'error':
                            if (!reader.startCall()) throw jail_error();
                            throw toValue(jaileval, reader);
                        case 'call':
                            if (!reader.startCall()) throw jail_error();
                            var index = reader.number();
                            if (index == null) throw jail_error();
                            if (!reader.next(',')) throw jail_error();
                            var call_index = reader.number();
                            if(call_index == null) throw jail_error();
                            if (!reader.next(',')) throw jail_error();
                            var thisArg = toValue(jaileval, reader);
                            var args = [];
                            while (reader.next(',')) {
                                args.push(toValue(jaileval, reader));
                            }
                            if (!reader.end()) throw jail_error();
                            if (index in jaileval.funcs) {
                                try {
                                    if (thisArg[jail_index] == 0) thisArg = self; //root
                                    var func = jaileval.funcs[index];
                                    if (func instanceof JailSynchronousFunction) func = func.value;
                                    else if(func instanceof JailVoidFunction) func = func.value;
                                    var result = func.apply(thisArg, args);
                                    worker.postMessage(">return [" + String(call_index) + ",(" + fromValue(jaileval, result) + ")];");
                                } catch (ex) {
                                    worker.postMessage("<return [" + String(call_index) + ",(" + fromValue(jaileval, ex) + ")];");
                                }
                            } else worker.postMessage("<return [" + String(call_index) + ",(" + fromValue(jaileval, new ReferenceError("Jail function not found")) + ")];");
                            break;
                        case 'callvoid':
                            if (!reader.startCall()) throw jail_error();
                            var index = reader.number();
                            if (index == null) throw jail_error();
                            if (!reader.next(',')) throw jail_error();
                            var thisArg = toValue(jaileval, reader);
                            var args = [];
                            while (reader.next(',')) {
                                args.push(toValue(jaileval, reader));
                            }
                            if (!reader.end()) throw jail_error();
                            if(index in jaileval.funcs) {
                                try {
                                    if (thisArg[jail_index] == 0) thisArg = self; //root
                                    var func = jaileval.funcs[index];
                                    if (func instanceof JailSynchronousFunction) func = func.value;
                                    else if(func instanceof JailVoidFunction) func = func.value;
                                    func.apply(thisArg, args);
                                } catch(ex) {
                                    Promise.reject(ex); //report error
                                }
                            } else Promise.reject(new ReferenceError("Jail function not found")); //report error
                            break;
                        case 'callsync':
                            if (!jaileval.data_buffer) {
                                var err = new Error("Worker called synchronous function while sharedArrayBuffer is not registered.");
                                me.forceTerminate(err);
                                throw err;
                            }
                            if (!reader.startCall()) throw jail_error();
                            var index = reader.number();
                            if (index == null) throw jail_error();
                            if (!reader.next(',')) throw jail_error();
                            var thisArg = toValue(jaileval, reader);
                            var args = [];
                            while (reader.next(',')) {
                                args.push(toValue(jaileval, reader));
                            }
                            if (!reader.end()) throw jail_error();
                            var rstr = '';
                            (async () => {
                                if (index in jaileval.funcs) {
                                    try {
                                        if (thisArg[jail_index] == 0) thisArg = self; //root
                                        var func = jaileval.funcs[index];
                                        var promise = false;
                                        if (func instanceof JailSynchronousFunction) {
                                            promise = func.promise;
                                            func = func.value;
                                        } else if(func instanceof JailVoidFunction) {
                                            func = func.value;
                                        }
                                        var result = func.apply(thisArg, args);
                                        if (promise) result = await result;
                                        rstr = 'return (' + fromValue(jaileval, result, true) + ');';
                                    } catch (ex) {
                                        rstr = 'throw (' + fromValue(jaileval, ex, true) + ');';
                                    }
                                } else rstr = 'throw new this.root.ReferenceError("Jail Function not found");'
                                postBuff = (new TextEncoder('utf-8')).encode(rstr);
                                var arr = new Int32Array(jaileval.data_buffer);
                                arr[1] = postBuff.byteLength;
                                var txt = new Uint8Array(jaileval.data_buffer);
                                var block = jaileval.data_buffer.byteLength - 8;
                                var cpy = postBuff.byteLength;
                                if (cpy > block) cpy = block;
                                for (var i = 0; i < cpy; i++) {
                                    txt[i + 8] = postBuff[i];
                                }
                                jaileval.buffer_state++;
                                jaileval.buffer_state = jaileval.buffer_state % 1024;
                                arr[0] = jaileval.buffer_state;
                                Atomics.notify(arr, 0);
                                if (postBuff.length > block) postBuff = postBuff.slice(block);
                                else postBuff = null;
                            })();
                            break;
                        case 'registerpromise':
                            if (!reader.startCall()) throw jail_error();
                            var index = reader.number();
                            if (index == null) throw jail_error();
                            if (!reader.next(',')) throw jail_error();
                            var resolve_index = reader.number();
                            if (resolve_index == null) throw jail_error();
                            if (!reader.next(',')) throw jail_error();
                            var reject_index = reader.number();
                            if (reject_index == null) throw jail_error();
                            var prom = jaileval.promises[index];
                            if (prom == undefined) return;
                            prom.value.then(
                                function (r) {
                                    jaileval("this.objs[" + String(resolve_index) + "](" + fromValue(jaileval, r) + ");");
                                },
                                function (r) {
                                    jaileval("this.objs[" + String(reject_index) + "](" + fromValue(jaileval, r) + ");");
                                });
                            break;
                        case 'message':
                            if (!reader.startCall()) throw jail_error();
                            var message = toValue(jaileval, reader);
                            for (var listener of jaileval.message_listeners) {
                                listener(message);
                            }
                            break;

                    }
                });
            }
            function jaileval(str) {
                if ('err' in jaileval) return Promise.reject(jaileval.err);
                if (jaileval.control.is_terminated) return Promise.reject(new Error('The jail was terminated'))
                return new Promise(function (resolve, reject) {
                    if (worker) worker.postMessage(str);
                    else cachedMsg.push(str);
                    value_callbacks.push({ resolve: resolve, reject: reject });
                });
            }

            if(newThread) {
                newThread().then(w => {
                    worker = w;
                    gotWorkerCode();
                }).catch(ex => this.terminate(ex));
            } else if(cachedWorkerCode) {
                gotWorkerCode();
            } else {    
                xhrResolvers.push(() => gotWorkerCode());
                if(!xhr) {
                    xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState == 2 && xhr.status != 200) {
                            me.forceTerminate(new Error("XHR for jailed JS failed."))
                        } else if (xhr.readyState == 4 && xhr.status == 200) {
                            xhr.onreadystatechange = null;
                            cachedWorkerCode = xhr.responseText;
                            for(var x of xhrResolvers) x(xhr.responseText);
                            xhrResolvers = null;
                        }
                    }
                    xhr.open('GET', jailedPath);
                    xhr.setRequestHeader('Accept', 'text/javascript');
                    xhr.send();
                }
            }
            //debug
            /*worker.postMessage = (function() {
                var oldPost = worker.postMessage.bind(worker);
                return function(m) {
                    console.debug("> "+ m);
                    return oldPost(m);
                };
            })();*/
            jaileval.symbols = {};
            jaileval.symbol_index = {};
            jaileval.objs = {};
            jaileval.funcs = {};
            jaileval.promises = {};
            jaileval.objscount = 1; //skip 0, that is root
            jaileval.worker = worker;
            jaileval.control = this;
            jaileval.terminate = do_terminate;
            jaileval.onTerminate = on_terminate;
            jaileval.value_callbacks = value_callbacks;
            jaileval.empty_callback = null;
            jaileval.empty_promise = null;
            jaileval.message_listeners = [];
            jaileval.data_buffer = null;
            jaileval.buffer_state = 0;
            jaileval.isThread = !!newThread || isChild;
            jaileval.children = [];
            jaileval.isChild = isChild;
            jaileval.parent = parent;
            jaileval.jailedCode = jaileval.parent ? jaileval.parent.jailedCode : jailCode;
            jaileval.threadsEnabled = false;
            jaileval.errorsSanitized = false;
            jaileval.next_callback = function () {
                if (jaileval.empty_callback != null && jaileval.value_callbacks.length >= 1) {
                    var callback = jaileval.empty_callback;
                    jaileval.empty_callback = null;
                    jaileval.empty_promise = null;
                    setTimeout(function () { callback.resolve(true); }, 0); //queue to surely know that the callback has been called and no other js is executing.
                }
                return jaileval.value_callbacks.shift();
            };

            Object.defineProperty(this, 'root', { configurable: false, enumerable: true, writable: false, value: toJailObject(jaileval, 0, null) });
            Object.defineProperty(this, 'apis', { configurable: false, enumerable: true, writable: false, value: toJailObject(jaileval, 1, null) });
            Object.defineProperty(this, 'apiEvents', { configurable: false, enumerable: true, writable: false, value: toJailObject(jaileval, 2, null) });
            Object.defineProperty(this, jail_eval, { configurable: false, enumerable: false, writable: false, value: jaileval });
            Object.defineProperty(this, 'is_terminated', { configurable: true, enumerable: true, writable: true, value: false });
            Object.defineProperty(this, "isThread", { configurable: false, writable: false, value: !!newThread || isChild });
            Object.defineProperty(this, "isParentChild", { configurable: false, writable: false, value: isChild });
            Object.defineProperty(this, "parent", { configurable: false, writable: false, value: parent });
            this.threadLimit = 4;
            /**
             * The default name for a script
             */
            this.defaultScriptName = "sandboxed";
            Object.seal(this);
            if(!isChild) jails.push(this);
        }

        /**
         * Execute a script and return the return value from it.
         * @param {string} src the script to execute
         * @param {string} name the name of the script (optional)
         */
        execute(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"eval";//# sourceURL=' + name + '\n' + String(src));
        }


        /**
         * Execute a script and return the return value from it as a resolved value.
         * @param {string} src the script to execute
         */
        executeAsResolved(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"eval_static";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Execute a piece of code in a function and return the return value from it.
         * @param {string} src the script to execute
         */
        executeAsFunction(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"function";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Execute a piece of code in async function and return the return value from it.
         * @param {string} src the script to execute
         */
        executeAsAsyncFunction(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"async_function";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Execute a piece of code in generator function and return the iterator from it.
         * @param {string} src the script to execute
         */
        executeAsGeneratorFunction(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"generator_function";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Compile the code as a Function (returning a JailObject containing the function)
         * @param {string} src the script to compile
         */
        compileAsFunction(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"compile";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Compile the code as a AsyncFunction (returning a JailObject containing the function)
         * @param {string} src the script to execute
         */
        compileAsAsyncFunction(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"compile_async";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Compile the code as a GeneratorFunction (returning a JailObject containing the function)
         * @param {string} src the script to execute
         */
        compileAsGeneratorFunction(src, name) {
            if (!name) name = this.defaultScriptName;
            if (!name) name = 'sandboxed';
            return this[jail_eval]('"compile_generator";//# sourceURL=' + name + '\n' + String(src));
        }

        /**
         * Force terminate the root jail. All pending (and new) operations will result in an error.
         * If the jail was executing some code, it will immediately stop.
         * @param {Error|undefined} err The error to show for executing tasks on this terminated jail.
         */
        forceTerminate(err) {
            this[jail_eval].terminate(err);
        }

        /**
         * Returns a promise when, that fullfils (true) when all requests has been send and responses has been recieved.
         * 
         * NOTE: the difference between .ping() and .onReady() is that .ping() sends a command to the jail
         * where the jail needs to reply on. If the .ping() replies, the jail does execute nothing. If the .onReady()
         * the jail is free from any waiting responses, but can still do some work. (for example setTimeout)
         * @returns {Promise<boolean>}
         */
        onReady() {
            var jaileval = this[jail_eval];
            if ('waiting' in jaileval) delete jaileval.waiting;
            else if ('err' in jaileval) return Promise.reject(jaileval.err);
            if (jaileval.value_callbacks.length < 1) return Promise.resolve(true);
            if (jaileval.empty_promise == null) jaileval.empty_promise =
                new Promise(function (resolve, reject) {
                    if ('err' in jaileval) reject(jaileval.err);
                    jaileval.empty_callback = { resolve: resolve, reject: reject };
                });
            return jaileval.empty_promise;
        }

        /**
         * Ping the jailed script, this function will return 'true' if the
         * jailed worker was free from any tasks, and is available to use.
         * 
         * @returns {Promise<boolean>} the promise that will evalulate to 'true' on success.
         */
        ping() {
            return this[jail_eval]('return true;');
        }

        /**
         * Soft terminate the jail. When the jail is available to use, it gets terminated.
         * If the terminate() function is called, no new tasks can be supplied.
         * 
         * @param {number|undefined} timeout If this arguments is supplied, after this amount of ms the jail will force terminate (and the promise throws an error).
         * @param {Error|undefined} err The error to show for executing tasks on this terminated jail.
         * @returns {Promise<boolean>} fullfills to true when the jail has been terminated.
         */
        terminate(timeout, err) {
            if (typeof err != 'object' && err != undefined) err = new JailTerminatedError(err);
            var me = this;
            return new Promise(function (resolve, reject) {
                var jaileval = me[jail_eval];
                if ('err' in jaileval) reject(jaileval.err);
                var id = null;
                if (timeout != undefined) {
                    id = setTimeout(function () {
                        try {
                            var err = new JailTerminatedError("The jail timed out (after a soft terminate) after " + String(timeout) + " milliseconds of delay.");
                            me.forceTerminate(err);
                        } catch (ex) { }
                    }, timeout);
                }
                var onFailure = function (ex) {
                    if (id != null) clearTimeout(id);
                    reject(ex);
                };
                //prevent any new tasks
                var ping = me.ping();
                jaileval.err = err == undefined ? new JailTerminatedError("The jail is waiting for termination. Can't perform any new actions.") : err;
                ping.then(function () {
                    jaileval.waiting = true;
                    Promise.all(me.getChildren().map(x => x.terminate(null, err).catch(() => {}))).then(() => me.onReady()).then(function (response) {
                        if (id != null) clearTimeout(id);
                        //update err
                        err = err == undefined ? new JailTerminatedError("The jail is terminated (soft), Can't perform any new actions.") : err;
                        jaileval.terminate(err);
                        resolve(response);
                    }, onFailure); //make sure that all callbacks has been called.
                }, onFailure);
            });
        }

        /**
         * Whitelist an object or property provided by the VM.
         * When the feature is whitelisted, it can't be blacklisted,
         * because the object could be cloned by the jailed code.
         * 
         * You can pass a single name for that specific object or
         * you can pass an array of object names.
         * @param {string|Array<string>} name 
         * @returns {Promise<boolean>} Gives true on success.
         */
        whitelistFeature(name) {
            return this[jail_eval]('return this.whitelist(' + JSON.stringify(name) + ')');
        }


        /**
         * Whitelist an event provided by the VM.
         * When the event is whitelisted, it can't be blacklisted.
         * 
         * You can pass a single name for that specific event or
         * you can pass an array of event names.
         * @param {string|Array<string>} name 
         * @returns {Promise<boolean>} Gives true on success.
         */
        whitelistEvent(name) {
            return this[jail_eval]('return this.whitelistEvent(' + JSON.stringify(name) + ')');
        }

        /**
         * Whitelist all features AND events, this is dangerous because that means
         * that the worker has access to 'all' functions, like XMLHttpRequest with cookies
         * and postMessage channels. So if you run this function, don't run any untrusted code!
         */
        whitelistAllFeatures() {
            return this[jail_eval]('return this.whitelist(this.util.keys(this.apis)) && this.whitelistEvent(this.util.keys(this.apiEvents));')
        }

        /**
         * Strip any trace of jailed.js in every Error stack created by the jail.
         * By new Error() (or new TypeError() etc); Error.prototype.toString; and any Error sent to the main.
         * 
         * E.g this:
         * ReferenceError: fsdf is not defined                                                                                                       
         *   at eval (term-0:2:1)                                                                                                                              
         *   at eval (<anonymous>)                                                                                                                             
         *   at eval (JailedCore:1699:37)                                                                                                                      
         *   at Object.jailFunc.snippets.eval (JailedCore:1630:60)                                                                                             
         *   at eval (JailedCore:1608:29)
         * 
         * Becomes:
         * ReferenceError: fdsf is not defined                                                                                                       
         *   at eval (term-0:2:1)
         * 
         * You need (or actually MUST) run this function before running any code to prevent weird results.
         * Also run this function BEFORE enableThreads() also to prevent weird results (with JailError)
         * 
         * Note that this function DOES NOT provide any extra security to the jailed code.
         * It can be bypassed easily
         * try {
         *   1n+2;
         * } catch(ex) {
         *   var theRealStack = ex.stack;
         *   ex.toString();
         *   var strippedStack = ex.stack;
         *   console.log(theRealStack);
         *   console.log(strippedStack)
         * }
         * 
         * See this as a 'error' cleaner and not for safety.
         * If some code calls to .toString() the stack will be stripped.
         * 
         * This error stripper currently only works (good) on chrome (more browsers in the future)
         * 
         * @returns 
         */
        sanitizeErrors() {
            if(this[jail_eval.errorsSanitized]) return Promise.resolve(false);
            return this[jail_eval]('return this.sanitizeErrors();').then(ret => {
                if(ret) {
                    this[jail_eval].errorsSanitized = true;
                }
                return ret;
            });
        }

        get errorsSanitized() {
            return this[jail_eval].errorsSanitized;
        }

        /**
         * If this sandbox is allowed to create new threads (by creating a sandbox in a sandbox)
         */
        get threadsEnabled() {
            return this[jail_eval].threadsEnabled;
        }

        /**
         * Enable 'threads' for this sandbox.
         * The entire Jail API will be exposed to the sandbox to create new sandboxes (threads)
         * Threads can create other threads.
         * The main code is te ancestor of all threads.
         * 
         * Every thread has a parent:
         * 1. It can be main. in that case the .parent property returns null
         * 2. It can be an another thread. in that case the .parent property returns a JailJS instance
         * 
         * The thread can inspect their children, execute or restrict code just like the parent object can do.
         * If children threads want to create new children, it must be first enabled by the parent with enableThreads
         * 
         * Children threads cannot access the JailJS of their parent.
         * 
         * Parent threads do not see threads in threads. Suppose the following:
         * A thread's parent is MAIN
         * B thread's parent is A
         * C thread's parent is B
         * D thread's parent is C
         * 
         * A has created B (new JailJS). A will see that C and D parent is both B (even if D is created by C)
         * B has created C and will see that D's parent is C
         * 
         * Properties:
         * isThread: returns true or false, if the parent of this thread is an another thread (and NOT main).
         * isParentChild: returns true or false, if the parent of this thread is an CHILD of this thread
         * parent: returns the parent of this thread or null if it cannot be accessed
         *         it can only be accessed if isParentChild is true.
         * 
         * @param {number} threadLimit Max amount of threads that this sandbox can create.
         *                             (default 4, is set to this.threadLimit)
         */
        async enableThreads(threadLimit) {
            if(this[jail_eval].isChild) throw new TypeError("You cannot enable threads on children/threads sandbox from the MAIN code. You need to run enableThreads() on the parent thead. ");
            if(this[jail_eval].threadsEnabled) throw new TypeError("Threads are already enabled");
            if(!this[jail_eval].jailedCode) {
                this[jail_eval].jailedCode = await this[jail_eval]("return this.jailedCode");
                jailCode = this[jail_eval].jailedCode;
            }
            if(threadLimit != null) this.threadLimit = threadLimit;
            var id = subId + "." + subIndex++;
            async function createThread() {
                if(this.threadLimit && this[jail_eval].children.length >= this.threadLimit) throw new Error("Thread limit reached");
                //this will point to a parent JailJS
                var child = new JailJS(wrapper_secret, this);
                child.onTerminate().catch(() => {}); //do not report uncaught promises
                this[jail_eval].children.push(child);
                var onTerminateListener = null;
                child.onTerminate().then(() => {
                    var ind = this[jail_eval].children.indexOf(child);
                    if(ind >= 0) this[jail_eval].children.splice(ind, 1);
                    if(onTerminateListener) onTerminateListener();
                });
                await child.executeAsFunction('(' + this[jail_eval].jailedCode + ')(' + JSON.stringify(String(id)) + ')', "JailedCore" + id);
                var messageListener;
                child.addMessageListener(async message => {
                    if(messageListener) { 
                        if(message instanceof JailObject) message = await message.resolve();
                        messageListener(message); 
                    }
                });
                return {
                    terminate: new JailVoidFunction(() => child.forceTerminate(new Error("Child is closed by parent"))),
                    setMessageListener: new JailVoidFunction(async (listener) => {
                        if(!listener) {
                            messageListener = null;
                            return;
                        }
                        if(listener instanceof JailObject) {
                            if(!listener.isFunction()) return;
                            listener = listener.valueOf(true);
                        }
                        if(typeof listener != 'function') return;
                        messageListener = listener;
                    }),
                    setOnTerminateListener: new JailVoidFunction(async(listener) => {
                        if(!listener) {
                            onTerminateListener = null;
                            return;
                        }
                        if(listener instanceof JailObject) {
                            if(!listener.isFunction()) return;
                            listener = listener.valueOf(true);
                        }
                        if(typeof listener != 'function') return;
                        onTerminateListener = listener;
                    }),
                    postMessage: new JailVoidFunction(async(message) => {
                        if(message instanceof JailObject) message = await message.resolve();
                        return child.postMessage(message);
                    })
                };
            }
            this[jail_eval].threadsEnabled = true;
            return (await this.executeAsFunction("return (" + jailFunc + ");", "JailJS")).invoke(this.root, [createThread.bind(this), jailFunc, this[jail_eval].jailedCode, id], true).catch(ex => {
                this[jail_eval].threadsEnabled = false;
                throw ex;
            });
        }

        getChildren() {
            return [...this[jail_eval].children];
        }
        
        /**
         * Get all the name of the properties provided by the VM, that are standard blacklisted.
         * All other properties provided by the VM, doesn't harm and only work with the executed code/data itself.
         * 
         * @return {Promise<Array<string>>}
         */
        getAllFeatures() {
            return this.apis.getOwnPropertyNames();
        }

        /**
         * Get all the name of the events provided by the VM, that are standard blacklisted.
         * 
         * @return {Promise<Array<string>>}
         */
        getAllEvents() {
            return this.apiEvents.getOwnPropertyNames();
        }

        /**
         * Timeouts jails activity after a specific delay. If the jail does not 
         * react (eg doing complex computations, infinity loops) after that delay, the
         * jail will immediately terminate.
         * @param {number} delay
         * @returns {Promise<boolean>} Normaly this function will return true (with resolved). 
         *                             If an error (with reject) is returned. the worker has been terminated. 
         */
        timeoutAfter(delay) {
            var me = this;
            var id = setTimeout(function () {
                try {
                    me.forceTerminate(new JailTerminatedError("The jail timed out after " + String(delay) + " milliseconds of delay."));
                } catch (ex) { }
            }, delay);
            var ret = this.ping();
            ret.then(function (result) {
                clearTimeout(id);
            }, function (ex) {
                clearTimeout(id);
            });
            return ret;
        }

        /**
         * Creates an empty object on the jail envrionment.
         * @returns {Promise<JailObject>} the empty object created on the jail.
         */
        createEmptyObject() {
            return this[jail_eval]("return {};");
        }

        /**
         * Creates an empty array on the jail envrionment.
         * @returns {Promise<JailObject>} the empty object created on the jail.
         */
        createEmptyArray() {
            return this[jail_eval]("return [];");
        }

        /**
         * Creates an empty set on the jail environment
         * 
         * use .valueOf() function on the created object to get the JailSet object (which you can use to add items)
         * @returns {Promise<JailObject>} the empty set created on the jail
         */
        createEmptySet() {
            return this[jail_eval]("return new this.root.Set();");
        }

        /**
         * Creates a set from an existing array
         * 
         * use .valueOf() function on the created object to get the JailSet object
         * @param {Array|JailObject} array the array, that contains the items for the set.
         */
        createSetFrom(array) {
            return this[jail_eval]("return new this.root.Set(" + fromValue(this[jail_eval], array) + ');');
        }

        /**
         * Creates an empty map on the jail environment
         * 
         * use .valueOf() function on the created object to get the JailSet object (which you can use to add items)
         * @returns {Promise<JailObject>} the empty map created on the jail
         */

        createEmptyMap() {
            return this[jail_eval]("return new this.root.Map();");
        }

        /**
         * Dispatchs a 'message' event in the jail for worker-like message communications.
         * 
         * You can listen to those message with addEventListener or .onmessage
         * Unlike worker message, you can pass abritary values like JailObjects and Symbols.
         * You can read the message in the JAIL with event.data
         * @param {*} message The data you want to post to the jail
         */
        postMessage(message) {
            return this[jail_eval]("return this.postMessage(" + fromValue(this[jail_eval], message) + ");");
        }

        /**
         * Add a listener that will be called by messages sent from the jail.
         * 
         * You can remove the listener by removeMessageListener.
         * @param {(message: any) => void} listener you listener. unlike the browser .onmessage this will not give you an Event (with .data) but directly the received data.
         */
        addMessageListener(listener) {
            if (!(listener instanceof Function)) throw new TypeError("Provide a function for addMessageListener");
            this[jail_eval].message_listeners.push(listener);
        }


        /**
         * Removes a listener from messages sent by jail
         * @param {(message: any) => void} listener the registered listener
         * @returns {boolean} if the listener was deleted (or not if it didn't exist)
         */
        removeMessageListener(listener) {
            var index = this[jail_eval].message_listeners.indexOf(listener);
            if (index < 0) return false;
            this[jail_eval].message_listeners.splice(index, 1);
            return true;
        }

        /**
         * Returns the jail value of the value.
         * Clones objects when necessary.
         * 
         * If the value is a primitive value, the same value is returned. (also for symbols)
         * If the value is a JailObject, the 'value' is returned.
         * If the value is an object/Array, the entire object is copied to the jail and a JailObject is returned instead.
         * If the value is a primitive wrapper (String, Number, Symbol...), a new wrapper for the jail is created (JailObject is returned).
         * 
         * You can get the primitive value (without waiting on a promise) from wrappers (JailObject) with the valueOf() method.
         * This works for String, Number, Symbol (object), BigInt, Boolean and also Date. (which will return a Date object instead of a primitive)
         * 
         * Symbols are linked between the jail and the main environment, even if they live in different javascript contexts.
         * That means that if you pass the same symbol from the main environment, the same symbol will be returned in the jail environment. And vice versa.
         * 
         * @param {*} value the value to convert to an jail value.
         * @returns {Promise<*>} the converted value for the jail.
         */
        jailOf(value) {
            return this[jail_eval]("return " + fromValue(this[jail_eval], value) + ";");
        }

        /**
         * Returns the normal JS value of the jail value.
         * 
         * If the value is a primitive value, the same value is returned.
         * If the value is a JailObject, the JailObject is deeply resolved (see JailObject.resolve(true))
         * If the value is an object, the same value is returned.
         * @param {*} value the value to convert
         * @returns {Promise<*>} the converted value.
         */
        valueOf(value) {
            if (typeof value == 'object' && value instanceof JailObject) {
                return value.resolve();
            } else return Promise.resolve(value);
        }

        /**
         * Convert 'value' to an Object in the jail envrionment.
         * 
         * If the value is a primitive type, an wrapper object (eg string to String) around that primitive type is returned.
         * If the value is either null or undefined, an empty object is returned.
         * If the value is already an object, the value is returned.
         * @param {*} value the value to convert to an object
         * @returns {Promise<JailObject>} the value converted to an object. 
         */
        objectOf(value) {
            return this[jail_eval]("return this.root.Object(" + fromValue(this[jail_eval], value) + ");");
        }

        /**
         * Enable synchronous API on the Jail (if browser supports Atomics)
         * @param {Number|undefined} buffer_size the size of the buffer (optional), 1024 minimum, 65536 default
         */
        enableSynchronousAPI(buffer_size) {
            if (!self.Atomics || !self.SharedArrayBuffer || !self.Uint8Array || !self.TextEncoder) return Promise.reject(new Error("Atomics not supported on this browser"));
            //onReady is used so that if NOW a synchronous function is running, it will not be disrupted (race condition)
            return this.ping().then(() => this.onReady()).then(() => {
                try {
                    if (!buffer_size) buffer_size = 65536;
                    buffer_size = Number(buffer_size);
                    if (isNaN(buffer_size) || buffer_size < 1024) buffer_size = 1024;
                    if (buffer_size % 4 != 0) buffer_size += 4 - (buffer_size % 4);
                    var buff = new SharedArrayBuffer(buffer_size);
                    this[jail_eval].data_buffer = buff;
                    this[jail_eval].worker.postMessage(buff);
                    return this[jail_eval]("return this.enableSynchronousAPI();");
                } catch (ex) { return Promise.reject(ex); }
            });
        }

        /**
         * Disable synchronous API on the jail
         */
        disableSynchronousAPI() {
            return this.ping().then(() => this.onReady()).then(() => this[jail_eval]("return this.disableSynchronousAPI();").then(() => this[jail_eval].data_buffer = null));
        }

        /**
         * Check if Synchronous API is enabled
         * @returns {boolean} if Syncronous API is enabled
         */
        get synchronousAPIEnabled() {
            return this[jail_eval].data_buffer != null;
        }

        /**
         * Returns a promise that fullfills (with the error as resolve) when the jail terminates.
         * @returns {Promise<Error>} the promise.
         */
        onTerminate() {
            return this[jail_eval].onTerminate;
        }
    };
    /**
     * Resolve the value asynchronously and returns a string representation for that value
     * @param {*} result the result to resolve
     * @param {(JailPromise => (string|Promise<string>))} promiseHandler a handler for promises, useful for interactive terminals where the text can be changed if a promises resolves (optional)
     * @returns {Promise<string>} A human readable string containg the information for this object
     */
    self.JailJS.variableToString = async function variableToString(result, promiseHandler) {
        if (typeof result == 'undefined') return 'undefined';
        else if (result == null) return 'null';
        else if (result instanceof JailObject) {
            if (result.isFunction()) {
                result = await result.invoke('toString', result, []);
            } else if (result.isRoot()) {
                result = 'self';
            } else {
                result = await variableToString(await result.resolve(false));
            }
        } else if (result instanceof JailPromise) {
            if (promiseHandler) return promiseHandler(result);
            if (result.success) {
                var val;
                result.finish(v => val = v);
                return "Promise resolved " + await variableToString(val);
            } else if (result.error) {
                var val;
                result.except(v => val = v);
                return "Promise rejected " + await variableToString(val);
            } else return "Promise pending";
        } else if (result instanceof Error) {
            if (result instanceof JailError && result.cause) return String(result.cause);
            else return String(result);
        } else if (typeof result == 'object') {
            if (result == null) return 'null';
            if (result instanceof Array) {
                var str = '[';
                var len = result.length;
                for (var i = 0; i < len; i++) {
                    if (i > 0) str += ',';
                    str += await variableToString(result[i]);
                }
                return str + ']';
            } else {
                var str;
                var noFinite = false;
                var first = true;
                if (result instanceof Number) {
                    str = '{' + String(result);
                    first = false;
                } else if (self.BigInt != null && result instanceof BigInt) {
                    str = '{' + String(result) + 'n';
                    first = false;
                } else if (result instanceof String) {
                    str = '{' + JSON.stringify(String(result));
                    first = false;
                    noFinite = true;
                } else if (result instanceof Boolean) {
                    str = '{' + (result.valueOf() ? 'true' : 'false');
                    first = false;
                } else if (result instanceof Symbol) {
                    str = '{' + result.toString();
                    first = false;
                } else if (result instanceof Set) {
                    var list = (await Promise.all([...result.values()].map(x => variableToString(x))));
                    first = false;
                    str = '{[' + list.join(', ') + ']';
                } else if (result instanceof Map) {
                    var list = (await Promise.all([...result.entries()].map(x => Promise.all([variableToString(x[0]), variableToString(x[1])]))));
                    first = list.length < 1;
                    str = '{' + list.map(x => x[0] + " => " + x[1]).join(', ');
                } else if (self.Uint8Array &&
                    (
                        (self.ArrayBuffer && result instanceof ArrayBuffer) ||
                        result instanceof Uint8Array ||
                        result instanceof Uint16Array ||
                        result instanceof Uint32Array ||
                        result instanceof Int8Array ||
                        result instanceof Int16Array ||
                        result instanceof Int32Array ||
                        result instanceof Float32Array ||
                        result instanceof Float64Array ||
                        (self.BigUint64Array && result instanceof BigUint64Array) ||
                        (self.SharedArrayBuffer && result instanceof SharedArrayBuffer)
                    )) {
                    var types = {
                        Uint8Array: self.Uint8Array,
                        Int8Array: self.Int8Array,
                        Uint16Array: self.Uint16Array,
                        Int16Array: self.Int16Array,
                        Uint32Array: self.Uint32Array,
                        Int32Array: self.Int32Array,
                        BigUint64Array: self.BigUint64Array,
                        BigInt64Array: self.BigInt64Array,
                        Float32Array: self.Float32Array,
                        Float64Array: self.Float64Array
                    };
                    var name = (self.SharedArrayBuffer && result instanceof SharedArrayBuffer) ? "SharedArrayBuffer" : ((self.ArrayBuffer && result instanceof ArrayBuffer) ? "ArrayBuffer" : null)
                    if (!name) {
                        for (var key in types) {
                            if (types[key] && result instanceof types[key]) {
                                name = key;
                            }
                        }
                    }
                    if (!name) throw new TypeError("Unknown binary array");
                    name = name.replace("Array", "");
                    first = false;
                    if (result instanceof ArrayBuffer || result instanceof SharedArrayBuffer) {
                        str = '{' + name + ' ' + ([...new Uint8Array(result.slice(0, 50))]
                            .map(x => x.toString(16).padStart(2, '0'))
                            .join(''))
                        if (result.byteLength > 50) str += '...';
                    } else {
                        noFinite = true;
                        str = '{' + name + ' [';
                        for (var i = 0; i < result.length; i++) {
                            if (i > 0) str += ', ';
                            str += String(result[i]);
                            if (i > 15) {
                                str += '...';
                                break;
                            }
                        }
                        str += ']';
                    }
                } else {
                    str = '{';
                }
                var keys = Object.getOwnPropertyNames(result);
                var allowed = "abcdefghijlkmnopqrstuvwxyzABCDEFHIJKLMNOPQRSTUVWXYZ_";
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (noFinite && isFinite(key)) continue;
                    if (!first) str += ', ';
                    if (key == undefined) continue;
                    var value = result[key];
                    var can = false;
                    if (typeof key == 'string') {
                        can = true;
                        var strlen = key.length;
                        for (var x = 0; x < strlen; x++) {
                            var chr = key.charAt(x);
                            if (!(allowed.includes(chr) || (x > 0 && isFinite(chr)))) {
                                can = false;
                                break;
                            }
                        }
                    }
                    first = false;
                    str += (can ? key : await variableToString(key)) + ': ' + await variableToString(value);
                }
                return str + '}';

            }
        } else if (typeof result == 'function') {
            if ('wrapper' in result) variableToString(result.wrapper);
            result = result.toString();
        } else if (typeof result == 'string') {
            return JSON.stringify(result);
        } else if (typeof result == 'bigint') {
            return String(result) + 'n';
        } else {
            result = String(result);
        }
        return result;
    }
    self.JailJS.getJails = () => [...jails];
    Object.defineProperty(self.JailJS, "isThread", {value: !!newThread, writable: false, configurable: false});
});
this.jailFunc(null, null, null, "");
