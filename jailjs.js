class JailError extends Error {}
class JailTerminatedError extends JailError {}
class JailPromise {
    constructor(promise) {
        if(promise instanceof JailPromise) promise = promise.value;
        if(!(promise instanceof Promise)) throw new TypeError('The promise argument needs to be a Promise');
        Object.defineProperty(this, 'value', {enumerable: true, configurable: false, writable: false, value: promise});
    }
}
(function() {
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
            if(this.index >= this.str.length) return null;
            var ind = this.index + token.length;
            if(ind >= this.str.length) return false;
            var part = this.str.substring(this.index, ind);
            if(part == token) {
                this.index = ind;
                return true;
            }
            return false;
        }

        name() {
            if(this.index >= this.str.length) return null;
            var strchr = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
            var strchr2 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
            for(var i = this.index; i < this.str.length; i++) {
                var chr = this.str.charAt(i);
                if(i > this.index) {
                    if(!strchr2.includes(chr)) {
                        var str = this.str.substring(this.index, i);
                        this.index = i;
                        return str;
                    }
                } else {
                    if(!strchr.includes(chr)) {
                        return null;
                    }
                }
            }
            var str = this.str.substring(this.index);
            this.index = this.str.length;
            return str;
        }
        string() {
            if(this.index >= this.str.length) return null;
            if(this.str.charAt(this.index) != '"') return null;
            this.index++;
            for(var i = this.index; i < this.str.length; i++) {
                var chr = this.str.charAt(i);
                if(chr == '\\') {
                    i++;
                } else if(chr == '"') {
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
            if(this.index >= this.str.length) return null;
            var numchr = '0123456789.'
            var numchr2 = '0123456789.oOxXbB'
            var may = false;
            for(var i = this.index; i < this.str.length; i++) {
                var ch = this.str.charAt(i);
                if(i == this.index) {
                    if(ch == '0') {
                        may = true;
                        continue;
                    } else if(ch == '-' || ch == '+');
                    else if(!numchr.includes(ch)) {
                        return null;
                    }
                } else {
                    if(!(may ? numchr2.includes(ch) : numchr.includes(ch))) {
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
            if(this.index >= this.str.length) return null;
            if(this.str.charAt(this.index) == '(') {
                this.stack.push(')');
                this.index++;
                return true;
            }
            return false;
        }

        startObject() {
            if(this.index >= this.str.length) return null;
            if(this.str.charAt(this.index) == '{') {
                this.stack.push('}');
                this.index++;
                return true;
            }
            return false;
        }

        startArray() {
            if(this.index >= this.str.length) return null;
            if(this.str.charAt(this.index) == '[') {
                this.stack.push(']');
                this.index++;
                return true;
            }
            return false;
        }

        end() {
            if(this.index >= this.str.length) return null;
            if(this.stack.length < 1) return false;
            if(this.stack[this.stack.length - 1] == this.str.charAt(this.index)) {
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
     * We use the stament 'throw jail_error()' to indicate that the message
     * recieved from the jail was incorrect. Normally this means that there is a bug.
     */
    var jail_error = () => new JailError('Incorrect message from jail.');
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
    var toJailObject = function(j_eval, index, primitive_value) {
        if(index in j_eval.objs) {
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
    var assign_object_from_value = function(jaileval, tokenizer, values) {
        if(tokenizer.startObject()) {
            while(!tokenizer.end()) {
                var key = toValue(jaileval, tokenizer);
                if(!tokenizer.next(':')) throw jail_error();
                var value = toValue(jaileval, tokenizer);
                tokenizer.next(',');
                values[key] = value;
            }
            return true;
        } else return false;
    }

    /**
     * Return the main JS value from a recieved jailed value.
     * @param {Function} jaileval the session for the jail.
     * @param {Tokenizer} tokenizer the tokenizer to read the value from.
     */
    var toValue = function(jaileval, tokenizer) {
        var val = tokenizer.string();
        if(val == null) val = tokenizer.number();
        if(val != null) return val;
        if(tokenizer.startArray()) {
            var values = [];
            while(!tokenizer.end()) {
                values.push(toValue(jaileval, tokenizer));
                tokenizer.next(',');
            }
            return values;
        } else {
            var obj = {};
            if(assign_object_from_value(jaileval, tokenizer, obj)) return obj;
        }
        var func = tokenizer.name();
        if(func == null) throw jail_error();
        func = func.toLowerCase();
        switch(func) {
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
            case 'string':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index != null) {
                if(!tokenizer.next(',')) throw jail_error();
                var value = tokenizer.string();
                if(value == null) throw jail_error();
                if(!tokenizer.end()) throw jail_error();
                return toJailObject(jaileval, index, value);
            } else {
                var value = tokenizer.string();
                if(value == null) throw jail_error();
                var primitive = new String(value);
                if(tokenizer.next(',')) {
                    if(!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
                }
                if(!tokenizer.end()) throw jail_error();
                return primitive;
            }
            case 'boolean':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index != null) {
                if(!tokenizer.next(',')) throw jail_error();
                var value = tokenizer.name();
                if(value == null) throw jail_error();                  
                value = value.toLowerCase() == 'true' ? true : false;
                if(!tokenizer.end()) throw jail_error();
                return toJailObject(jaileval, index, value);
            } else {
                var value = tokenizer.name();
                if(value == null) throw jail_error();
                var primitive = new Boolean(value.toLowerCase() == 'true' ? true : false);
                if(tokenizer.next(',')) {
                    if(!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
                }
                if(!tokenizer.end()) throw jail_error();
                return primitive;
            }
            case 'number':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            var isNext = false;
            if(tokenizer.next(',')) {
                isNext = true;
                var value = tokenizer.number();
                if(value != null) {
                    if(!tokenizer.end()) throw jail_error();
                    return toJailObject(jaileval, index, value);
                }
            }
            var value = index;
            var primitive = new Number(value);
            if(isNext) {
                if(!assign_object_from_value(jaileval, tokenizer, primitive)) throw jail_error();
            }
            if(!tokenizer.end()) throw jail_error();
            return primitive;
            case 'promise':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.end()) throw jail_error();
            if(index in jaileval.promises) {
                return toJailObject(jaileval, index, jaileval.promises[index]);
            }
            var ind = -(jaileval.objscount);
            jaileval.objscount += 2;
            if(!('err' in jaileval))
                jaileval("this.util.promiseThen(this.objs[" + String(index) + "], this.wrap('function'," + String(ind) + "), this.wrap('function'," + String(ind - 1) + "));");
            var promise = new JailPromise(new Promise(function(resolve, reject) {
                jaileval.funcs[ind] = function(result) {
                    delete jaileval.funcs[ind];
                    delete jaileval.funcs[ind-1];
                    resolve(result);
                }
                jaileval.funcs[ind-1] = function(result) {
                    delete jaileval.funcs[ind];
                    delete jaileval.funcs[ind-1];
                    reject(result);
                }
            }));
            jaileval.promises[index] = promise;
            return toJailObject(jaileval, index, promise);
            case 'wrapperpromise':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.end()) throw jail_error();
            if(index in jaileval.promises) {
                return jaileval.promises[index];
            }
            var ind = -(jaileval.objscount);
            jaileval.objscount += 2;
            if(!('err' in jaileval))
                jaileval("this.util.promiseThen(this.objs[" + String(index) + "], this.wrap('function'," + String(ind) + "), this.wrap('function'," + String(ind - 1) + "));");
            var promise = new JailPromise(new Promise(function(resolve, reject) {
                jaileval.objs[ind] = function(result) {
                    delete jaileval.objs[ind];
                    delete jaileval.objs[ind-1];
                    resolve(result);
                }
                jaileval.objs[ind-1] = function(result) {
                    delete jaileval.objs[ind];
                    delete jaileval.objs[ind-1];
                    reject(result);
                }
            }));
            jaileval.promises[index] = promise;
            return promise;
            case 'function':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.end()) throw jail_error();
            return toJailObject(jaileval, index, jail_function);
            case 'wrapperfunction':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.end()) throw jail_error();
            return (toJailObject(jaileval, index, jail_function)).valueOf();
            case 'array':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.end()) throw jail_error();
            return toJailObject(jaileval, index, jail_array);
            case 'object':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.end()) throw jail_error();
            return toJailObject(jaileval, index, null);
            case 'symbol':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.next(',')) throw jail_error();
            var name = tokenizer.string();
            if(name == null) {
                if(!tokenizer.next('null')) throw jail_error();
                name = undefined;
            }
            if(!tokenizer.end()) throw jail_error();
            var symbol;
            if(index in jaileval.symbol_index) {
                symbol = jaileval.symbol_index[index];
            } else {
                symbol = name == undefined ? Symbol() : Symbol(name);
                jaileval.symbols[symbol] = index;
                jaileval.symbol_index[index] = symbol;
            }
            return symbol;
            case 'symbolobject':
            if(!tokenizer.startCall()) throw jail_error();
            var index = tokenizer.number();
            if(index == null) throw jail_error();
            if(!tokenizer.next(',')) throw jail_error();
            var name = tokenizer.string();
            if(name == null) {
                if(!tokenizer.next('null')) throw jail_error();
                name = undefined;
            }
            var symbol;
            if(index in jaileval.symbol_index) {
                symbol = jaileval.symbol_index[index];
            } else {
                symbol = name == undefined ? Symbol() : Symbol(name);
                jaileval.symbols[symbol] = index;
                jaileval.symbol_index[index] = symbol;
            }
            var hasNext = false;
            if(tokenizer.next(',')) {
                hasNext = true;
                var object_index = tokenizer.number();
                if(object_index != null) {
                    if(!tokenizer.end()) throw jail_error();
                    return toJailObject(jaileval, object_index, symbol);
                }
            }
            var obj = Object(symbol);
            if(hasNext) {
                if(!assign_object_from_value(jaileval, tokenizer, obj)) throw jail_error();
            }
            if(!tokenizer.end()) throw jail_error();
            return obj;
            case 'error':
            if(!tokenizer.startCall()) throw jail_error();
            var name = tokenizer.string();
            if(!tokenizer.next(',')) throw jail_error();
            var message = tokenizer.string();
            if(!tokenizer.next(',')) throw jail_error();
            var stack = tokenizer.string();
            if(tokenizer.next(',')) {
                var object_index = tokenizer.number();
                if(object_index == null) {
                    var err = new JailError(message);
                    err.name = name;
                    err.stack += '\n\r' + stack;
                    err.jail_stack = stack;
                    if(!assign_object_from_value(jaileval, tokenizer, err)) throw jail_error();
                    if(!tokenizer.end()) throw jail_error();
                    return err;
                }
                if(!tokenizer.end()) throw jail_error();
                var err = new JailError(message);
                err.name = name;
                err.stack += '\n\r' + stack;
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
    var fromValue = function(jaileval, value) {
        if(typeof value == 'undefined') {
            return 'this.root.undefined';
        } else if(value == null) {
            return 'null';  
        } else if(typeof value == 'number') {
            if(isNaN(value)) {
                return 'this.root.NaN';
            } else if(value == Infinity) {
                return 'this.root.Infinity'
            } else if(value == -Infinity) {
                return '(-this.root.Infinity)'
            } else {
                return '(' + String(value) + ')';
            }
        } else if(typeof value == 'string') {
            return '(' + JSON.stringify(value) + ')';
        } else if(typeof value == 'symbol') {
            var index;
            if(value in jaileval.symbols) {
                index = jaileval.symbols[value];
            } else {
                index = -(jaileval.objscount++);
                jaileval.symbols[value] = index;
                jaileval.symbol_index[index] = value;
            }
            return '(this.symbol(' + String(index) + ',' + JSON.stringify(value.description) + '))';
        } else if(typeof value == 'function') {
            var index;
            var objskeys = Object.keys(jaileval.funcs);
            var objslen = objskeys.length;
            for(var i = 0; i < objslen; i++) {
                var key = objskeys[i];
                if(key == undefined) continue;
                if(jaileval.funcs[key] === value) index = value;
            }
            if(index == null) index = -(jaileval.objscount++);
            jaileval.funcs[index] = value;
            return '(this.wrap("function",' + String(index) + '))';
        } else if(typeof value == 'boolean') {
            return value ? 'true' : 'false';
        } else if(value instanceof Promise || value instanceof JailPromise) {
            if(value instanceof JailPromise) value = value.value;
            if(index in jaileval.promises) {
                return '(this.wrap("promise", ' + String(index) + '))';
            }
            var index = -(jaileval.objscount++);
            jaileval.promises[index] = new JailPromise(value);
            return '(this.wrap("promise", ' + String(index) + '))';
        } else if(value instanceof String) {
            return '(new this.root.StringType(' + JSON.stringify(String(value)) + '))';
        } else if(value instanceof Number) {
            return '(new this.root.Number(' + String(value) + '))';
        } else if(value instanceof Symbol) {
            var index;
            value = value.valueOf();
            if(value in jaileval.symbols) {
                index = jaileval.symbols[value];
            } else {
                index = -(jaileval.objscount++);
                jaileval.symbols[value] = index;
                jaileval.symbol_index[index] = value;
            }
            return '(this.root.Object(this.symbol(' + String(index) + ',' + JSON.stringify(value.description) + ')))';
        } else if(value instanceof Boolean) {
            return '(new this.root.Boolean(' + (value.valueOf() ? 'true' : 'false') + '))';
        } else if(value instanceof Array) {
            var length = value.length;
            var str = '[';
            for(var i = 0; i < length; i++) {
                if(i > 0) str += ',';
                str += fromValue(jaileval, value[i]);
            }
            return '(' + str + '])';
        } else if(value instanceof JailObject) {
            return '(this.objs[' + String(value[jail_index]) + '])';
        } else if(value instanceof Error) {
            return '(this.wrap("error", {name:' + JSON.stringify(value.name) + ',message:' + JSON.stringify(value.message) + ',stack:' + JSON.stringify(value.stack) + '}))';
        } else {
            var keys = Object.keys(value);
            var length = keys.length;
            var str = '{';
            for(var i = 0; i < length; i++) {
                var key = keys[i];
                if(key == undefined) continue;
                var v = value[key];
                if(i > 0) str += ',';
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
    var getFieldLocation = function(obj, name) {
        var str;
        if(name == undefined || name == '') {
            str = 'this.objs[' + String(obj[jail_index]) + ']';
        } else {
            if(name instanceof Array) {
                str = 'this.objs[' + String(obj[jail_index]) + ']';
                for(var i = 0; i < name.length; i++) {
                    var val = name[i];
                    if(typeof val != 'string' && !(val instanceof String) && typeof val != 'symbol') {
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
    self.JailObject = class {
        constructor(secret, j_eval, index, primitive_value) {
            if(!(secret === wrapper_secret)) 
                throw new Error("You may not create a JailObject instance.");
            Object.defineProperty(this, jail_eval, {configurable: false, enumerable: false, writable: false, value: j_eval});
            Object.defineProperty(this, jail_index, {configurable: false, enumerable: false, writable: false, value: index});
            Object.defineProperty(this, jail_primitive, {configurable: false, enumerable: false, writable: false, value: primitive_value == undefined ? null : primitive_value});
            Object.defineProperty(this, 'jail', {configurable: false, enumerable: false, writable: false, value: j_eval.control})
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
            if(name == null || name == '' || (name instanceof Array && name.length == 0)) throw new TypeError("The name can't be empty for set.");
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
            if(name == null || name == '' || (name instanceof Array && name.length == 0)) throw new TypeError("The name can't be empty for delete.");
            return this[jail_eval]('return delete ' + getFieldLocation(this, name) + ';')
        } 

        /**
         * Returns true if the field is in this object.
         * @param {string|symbol|Array} name
         * @returns {Promise<boolean>}
         */
        has(name) {
            var loc = [];
            if(name == null || name == '' || (name instanceof Array && name.length == 0)) return this[jail_eval](String(this[jail_index]) + ' in this.objs');
            if(name instanceof Array) {
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
         * invoke(bind, args)
         * invoke(args)
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
         */
        invoke(name, bind, args) {
            var thisLocation = '';
            if(args == undefined) {
                if(typeof name == 'string' || typeof name == 'symbol' || name instanceof String || name instanceof Symbol) {
                    args = bind;
                    bind = null;
                } else {
                    if(bind != undefined) {
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
            if(bind == undefined) bind = null;
            if(args == undefined || !(args instanceof Array)) {
                args = [];
            }
            if(name instanceof String || name instanceof Symbol) name = name.valueOf();
            if(name instanceof Array) {
                thisLocation = Object.assign([], name);
                if(thisLocation.length > 1) {
                    thisLocation.pop();
                } else thisLocation = '';
            }
            var str = '"call"; return {function: ' + getFieldLocation(this, name) + ',args:[';
            for(var i = 0; i < args.length; i++) {
                if(i > 0) str += ',';
                str += '(' + fromValue(this[jail_eval], args[i]) + ')';
            }
            str += ']';
            if(bind != null) {
                str += ',bind:(' + fromValue(this[jail_eval], bind) + ')';
            } else {
                if(name == '' || (name instanceof Array && name.length < 1)) {
                    str += ',bind:self'
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
            return this[jail_eval]('return this.util.defineProperty(this.objs[' + String(this[jail_index]) + '], ' + fromValue(this[jail_eval], name) + ', ' + fromValue(this[jail_eval],descriptor) + ');')
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
            return this[jail_eval]('return this.static(this.util.freezeObject(this.objs[' + String(this[jail_index]) + ']));')
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
            return this[jail_eval]('return this.static(this.util.ObjectSeal(this.objs[' + String(this[jail_index]) + ']));')
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

        /**
         * This function will prevent any new properties to be created on this object.
         * @returns {Promise}
         */
        preventExtensions() {
            return this[jail_eval]('return this.static(this.util.ObjectPreventExtensions(this.objs[' + String(this[jail_index]) + ']));')
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
            var r = this.valueOf();
            if(r != null) {
                if(r instanceof Promise) return Promise.resolve(new JailPromise(r));
                else if(typeof r == 'object' || typeof r == 'function') return Promise.resolve(r);
                else return Promise.resolve(Object(r));
            }
            if(deep == undefined) deep = true;
            return this[jail_eval]('return this.static(this.objs[' + String(this[jail_index]) + '],' + (deep ? 'true' : 'false') + ');');
        }

        /**
         * Check if this object is instanceof an other object 'other'
         * @param {Promise<Boolean>} other 
         */
        instanceOf(other) {
            return this[jail_eval]('return this.objs[' + String(this[jail_index]) + '] instanceof (' + fromValue(this[jail_eval], other) + ');')
        }

        /**
         * Check if this object is a function.
         * @returns {boolean}
         */
        isFunction() {
            return this[jail_primitive] == jail_function;
        }

        /**
         * Check if this object is an array
         * @returns {boolean}
         */
        isArray() {
            return this[jail_primitive] == jail_array;
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
         * Get the length of this array or string.
         * 
         * If the value type is an Array, the length of the array is returned.
         * If the value type is an String, the length of the string is returned
         * Otherwise the object is tried to be converted to an array and the length of that is returned.
         * @returns {Promise<number>} the length of this object
         */
        length() {
            var value = this[jail_primitive];
            if(value == jail_array) {
                return this[jail_eval]('return this.util.arrayLength(this.objs[' + String(this[jail_index]) + ']);');
            } else if(value == jail_function) return Promise.reject(new TypeError("jailed functions don't have lengths"));
            else if(typeof value == 'string') return value.length;
            else return this[jail_eval]('return this.util.arrayLength(this.util.toArray(this.objs[' + String(this[jail_index]) + ']));');
        }
        /**
         * Returns the primitive value of this object, returns null if this object
         * doesn't have a primitive value.
         * @returns {boolean|string|symbol|number|Promise|Function|Error|undefined}
         */
        valueOf() {
            if(this[jail_primitive] == jail_function) {
                var index = this[jail_index];
                var jaileval = this[jail_eval];
                var me = this;
                var ret;
                if(index in jaileval.funcs) {
                    var func = jaileval.funcs[index];
                    ret = function() {
                        try {
                            var result = func.apply(this, Array.prototype.slice.call(arguments));
                            if(result instanceof Promise) result = new JailPromise(result);
                            return Promise.resolve(result);
                        } catch(ex) {
                            if(ex instanceof Promise) ex = new JailPromise(ex);
                            return Promise.reject(ex);
                        }
                    };
                } else {
                    ret = function() {
                        return me.invoke('', this, Array.prototype.slice.call(arguments));
                    };
                }
                ret.wrapper = this;
                return ret;
            } else if(this[jail_primitive] == jail_array) {
                return null;
            } else {
                return this[jail_primitive];
            }
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

    };
    self.JailJS = class { 
        constructor() {

            var value_callbacks = [];
            var do_terminate;
            var me = this;
            var on_terminate = new Promise(function(resolve, reject) {
                var terminated = false;
                do_terminate = function(err) {
                    if(!terminated) {
                        if(typeof err != 'object' && err != undefined) err = new JailTerminatedError(err);
                        Object.defineProperty(me, 'is_terminated', {configurable: false, enumerable: true, writable: false, value: true});
                        me[jail_eval].worker.terminate();
                        var callbacks = me[jail_eval].value_callbacks;
                        me[jail_eval].err = err == undefined ? new JailTerminatedError("The jail is gracefully terminated, can't perform any actions.") : err;
                        if(err == undefined) err = me[jail_eval].err;
                        if(jaileval.empty_callback != null) jaileval.empty_callback.reject(err);
                        while(callbacks.length > 0) {
                            callbacks.pop().reject(err)
                        }
                        //free indexes from JS
                        jaileval.symbols = {};
                        jaileval.symbol_index = {};
                        jaileval.objs = {};
                        jaileval.funcs = {};
                        jaileval.promises = {};
                        resolve();
                        terminated = true;
                    }
                }
            });

            var worker = new Worker(jailedPath);
            function jaileval(str) {
                if('err' in jaileval) return Promise.reject(jaileval.err);
                if(jaileval.control.is_terminated) return Promise.reject(new Error('The jail was terminated'))
                return new Promise(function(resolve, reject) {
                    worker.postMessage(str);
                    value_callbacks.push({resolve: resolve, reject: reject});
                });
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
            jaileval.next_callback = function() {
                if(jaileval.empty_callback != null && jaileval.value_callbacks.length >= 1) {
                    var callback = jaileval.empty_callback;
                    jaileval.empty_callback = null;
                    jaileval.empty_promise = null;
                    setTimeout(function() {callback.resolve(true);}, 0); //queue to surely know that the callback has been called and no other js is executing.
                }
                return jaileval.value_callbacks.shift();
            };

            worker.addEventListener('message', function(e) {
                //debug
                //console.debug("< " + e.data);
                var message = e.data;
                var reader = new Tokenizer(e.data);
                var func = reader.name();
                if(func == null) throw jail_error();
                func = func.toLowerCase();
                switch(func) {
                    case 'return':
                        if(!reader.startCall()) throw jail_error();
                        if(value_callbacks.length < 1) return;
                        jaileval.next_callback().resolve(toValue(jaileval, reader));
                        break;
                    case 'returnerror':
                        if(!reader.startCall()) throw jail_error();
                        if(value_callbacks.length < 1) return;
                        jaileval.next_callback().reject(toValue(jaileval, reader));
                        break;
                    case 'error':
                        if(!reader.startCall()) throw jail_error();
                        throw toValue(jaileval, reader);
                    case 'call':
                        if(!reader.startCall()) throw jail_error();
                        var index = reader.number();
                        if(index == null) throw jail_error();
                        if(!reader.next(',')) throw jail_error();
                        var thisArg = toValue(jaileval, reader);
                        var args = [];
                        while(reader.next(',')) {
                            args.push(toValue(jaileval, reader));
                        }
                        if(!reader.end()) throw jail_error();
                        if(index in jaileval.funcs) {
                            try {
                                if(thisArg[jail_index] == 0) thisArg = self; //root
                                var result = jaileval.funcs[index].apply(thisArg, args);
                                worker.postMessage(">return " + fromValue(jaileval, result));
                            } catch(ex) {
                                worker.postMessage("<return " + fromValue(jaileval, ex));
                            }
                        }
                        break;
                    case 'registerpromise':
                        if(!reader.startCall()) throw jail_error();
                        var index = reader.number();
                        if(index == null) throw jail_error();
                        if(!reader.next(',')) throw jail_error();
                        var resolve_index = reader.number();
                        if(resolve_index == null) throw jail_error();
                        if(!reader.next(',')) throw jail_error();
                        var reject_index = reader.number();
                        if(reject_index == null) throw jail_error();
                        var prom = jaileval.promises[index];
                        if(prom == undefined) return;
                        prom.value.then(
                        function(r) {
                            jaileval("this.objs[" + String(resolve_index) + "](" + fromValue(jaileval, r) + ");");
                            delete jaileval.objs[index];
                        },
                        function(r) {
                            jaileval("this.objs[" + String(reject_index) + "](" + fromValue(jaileval, r) + ");");
                            delete jaileval.objs[index];
                        });
                }
            });

            Object.defineProperty(this, 'root', {configurable: false, enumerable: true, writable: false, value: toJailObject(jaileval, 0, null)});
            Object.defineProperty(this, 'apis', {configurable: false, enumerable: true, writable: false, value: toJailObject(jaileval, 1, null)});
            Object.defineProperty(this, jail_eval, {configurable: false, enumerable: false, writable:false, value: jaileval});
            Object.defineProperty(this, 'is_terminated', {configurable: true, enumerable: true, writable: true, value: false});
            Object.seal(this);
        }

        /**
         * Execute a script and return the return value from it.
         * @param {string} src the script to execute
         */
        execute(src) {
            return this[jail_eval]('"eval";' + String(src));
        }


        /**
         * Execute a script and return the return value from it as a resolved value.
         * @param {string} src the script to execute
         */
        executeAsResolved(src) {
            return this[jail_eval]('"eval_static";' + String(src));
        }

        /**
         * Execute a piece of code in a function and return the return value from it.
         * @param {string} src the script to execute
         */
        executeAsFunction(src) {
            return this[jail_eval]('"function";' + String(src));
        }
                
        /**
         * Execute a piece of code in async function and return the return va;ue from it.
         * @param {string} src the script to execute
         */
        executeAsAsyncFunction(src) {
            return this[jail_eval]('"async_function";' + String(src));
        }

        /**
         * Execute a piece of code in generator function and return the iterator from it.
         * @param {string} src the script to execute
         */
        executeAsGeneratorFunction(src) {
            return this[jail_eval]('"generator_function";' + String(src));
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
            if('waiting' in jaileval) delete jaileval.waiting;
            else if('err' in jaileval) return Promise.reject(jaileval.err);
            if(jaileval.value_callbacks.length < 1) return Promise.resolve(true);
            if(jaileval.empty_promise == null) jaileval.empty_promise = 
                new Promise(function(resolve, reject) {
                    if('err' in jaileval) reject(jaileval.err);
                    jaileval.empty_callback = {resolve: resolve, reject: reject};
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
            if(typeof err != 'object' && err != undefined) err = new JailTerminatedError(err);
            var me = this;
            return new Promise(function(resolve, reject) {
                var jaileval = me[jail_eval];
                if('err' in jaileval) reject(jaileval.err);
                var id = null;
                if(timeout != undefined) {
                    id = setTimeout(function() {
                        try {
                            var err = new JailTerminatedError("The jail timed out (after a soft terminate) after " + String(timeout) + " milliseconds of delay.");
                            me.forceTerminate(err);
                        } catch(ex) {}
                    }, timeout);
                }
                var onFailure = function(ex) {
                    if(id != null) clearTimeout(id); 
                    reject(ex);
                };
                //prevent any new tasks
                var ping = me.ping();
                jaileval.err = err == undefined ? new JailTerminatedError("The jail is waiting for termination. Can't perform any new actions.") : err;
                ping.then(function(response) {
                    jaileval.waiting = true;
                    me.onReady().then(function(response) {
                        if(id != null) clearTimeout(id);
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
         * When the feature is whitelisted, it can't be blacklisted.
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
         * Whitelist all features, this is dangerous because that means
         * that the worker has access to 'all' functions, like XMLHttpRequest with cookies
         * and postMessage channels. So if you run this function, don't run any untrusted code!
         */
        whitelistAllFeatures() {
            return this[jail_eval]('return this.whitelist(this.util.keys(this.apis));')
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
         * Timeouts jails activity after a specific delay. If the jail does not 
         * react (eg doing complex computations, infinity loops) after that delay, the
         * jail will immediately terminate.
         * @param {number} delay
         * @returns {Promise<boolean>} Normaly this function will return true (with resolved). 
         *                             If an error (with reject) is returned. the worker has been terminated. 
         */
        timeoutAfter(delay) {
            var me = this;
            var id = setTimeout(function() {
                try {
                    me.forceTerminate(new JailTerminatedError("The jail timed out after " + String(delay) + " milliseconds of delay."));
                } catch(ex) {}
            }, delay);
            var ret = this.ping();
            ret.then(function(result) {
                clearTimeout(id);
            }, function(ex) {
                clearTimeout(id);
            });
            return ret;
        }

        /**
         * Creates an empty object at the jail envrionment.
         * @returns {Promise<JailObject>} the empty object created at the jail.
         */
        createEmptyObject() {
            return this[jail_eval]("return {};");
        }

        /**
         * Creates an empty array at the jail envrionment.
         * @returns {Promise<JailObject>} the empty object created at the jail.
         */
        createEmptyArray() {
            return this[jail_eval]("return [];");
        }

        /**
         * Returns the jail value of the value.
         * 
         * If the value is a primitive value, the same value is returned.
         * If the value is a JailObject, the 'value' is returned.
         * If the value is an object/Array, the entire object is copied to the jail.
         * If the value is a primitive wrapper (String, Number, Symbol...), a new wrapper for the jail is created (JailObject is returned).
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
            if(typeof value == 'object' && value instanceof JailObject) {
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
         * Returns a promise that fullfills (with the error as resolve) when the jail terminates.
         * @returns {Promise<Error>} the promise.
         */
        onTerminate() {
            return this[jail_eval].onTerminate;
        }
    }
})();