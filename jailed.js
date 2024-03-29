//# sourceURL=JailedCore
/*
    Do NOT bundle or compile this file. Those bundlers/compilers can modify the source code and possibly
    add ton of extra variables to the script (and the sandboxed code). Change your webpack config that jailed.js
    will not be compiled or bundled and stays the same (like a binary file.)

    See also README.md
*/

/**
 * The code for the communication between the jail and the main program. (on the jail side)
 * will work in a closure. Why? Every important local value and function in this closure will not be accessible
 * outside this closure for the jailed code.
 */
this.jailFunc = (function (jailID) {
    this.onmessage = null;
    (function (global_eval) {
        if(this.jailFunc) {
            var jailedCode = this.jailFunc.toString();
            delete this.jailFunc;
        }
        Object.defineProperty(global_eval, "name", {configurable: false, writable: false, value: 'RunJailedCode' + jailID});
        var undefined = undefined;
        /**
         * The untrusted code may alter any important native function (and its properties!) and value that are provided from the javascript engine,
         * to prevent that, we copy all required native functions to the root value. So any malicous edits
         * to the native functions will not affect the communication between the jail and the main program.
         */
        var root;

        /**
         * Normal types are linked with indexes, every access needs to be asked.
         * Static types are evaluted types and their whole value are sended to the main program.
         * Their are not linked to the jail anymore.
         * 
         * You create a static type by 'this.static(value)' from an execute expression.
         * @param {*} x 
         */
        var StaticType = function (x, y) { this.value = x; this.deep = y; };

        /**
         * This function is used for the .tostring by functions recieved from the main program.
         */
        var jailed_to_string = function JailedFunctionToString() { return "function " + (this.name || "") + "() { [" + (this.isSynchronous ? "Synchronous " : "") + (this.isVoid ? "Void " : "") + "Jail API] }" };

        /**
         * In the jail, only basic JS function are available.
         * We can make more available, the other functions are stored in 'apis'
         */
        var apis = {};
        var apiEvents = {};
        var registerRootListener = () => { };
        var rootEventTarget = null;

        /**
         * This closure fills the root object up with the required functions for the communication.
         */
        (function () {
            /**
             * We can't invoke functions on functions, because they may be altered. Their is no
             * global 'bind' that binds a function to a this, we can only call bind on a function.
             * So we need to make our own global bind. The alternative is, to bind to itself: bind(bind). called 'bindFunction'
             * If we call this function with the argument x as function, 'bind' will bind x to it's this (that is bind).
             * So you get a 'bind' where it's this is equal to x. If you call that function with y,
             * bind will bind y as this for it's this (x). x is binded to this y.
             * 
             * x.bind(y) == globalBind(x, y) == bind(bind)(x)(y) == bindFunction(x)(y)
             */
            var bindFunction = Function.prototype.bind.bind(Function.prototype.bind);
            var bind = function (f, t) { //globalBind, now it's just called 'bind'
                return bindFunction(f)(t);
            }
            /*
                Currently, when this code is executed, non of the untrusted code has been executed.
                That means that we can safely use any native function, BUT when untrusted code
                is going to be exeucted, we can't trust anymore any of these values. So we need to rely
                on the 'root' variable. (see above).
            */
            var apply = Function.prototype.apply.bind(Function.prototype.call);
            var _substring = String.prototype.substring;
            var _indexOf = String.prototype.indexOf;
            var _startsWith = String.prototype.startsWith;
            var _split = String.prototype.split;
            var _includes = String.prototype.includes;
            var _getLength = Object.getOwnPropertyDescriptor(Array.prototype, 'length');
            if (_getLength && _getLength.get) _getLength = _getLength.get;
            else if (!_getLength || _getLength.configurable) {
                try {
                    Object.defineProperty(Array.prototype, "length", { value: 0, writable: true, configurable: false });
                } catch (ex) { }
                _getLength = undefined;
            } else _getLength = undefined;
            var _getDescription = Object.getOwnPropertyDescriptor(Symbol.prototype, 'description');
            if (_getDescription) _getDescription = _getDescription.get;
            var _str_getLength = Object.getOwnPropertyDescriptor(String.prototype, "length");
            if (_str_getLength && _str_getLength.get) _str_getLength = _str_getLength.get;
            else if (!_str_getLength || _str_getLength.configurable) {
                try {
                    Object.defineProperty(String.prototype, "length", { value: 0, writable: false, configurable: false });
                } catch (ex) { }
                _str_getLength = undefined;
            } else _str_getLength = undefined;
            var _getArray = Array.prototype.slice;
            var _splice = Array.prototype.splice;
            var _trim = String.prototype.trim;
            var _String = String;
            var _s_toString = String.prototype.toString;
            var _n_toString = Number.prototype.toString;
            var _b_toString = Boolean.prototype.toString;
            var _replace_string = String.prototype.replace;
            var _push = Array.prototype.push;
            var _pop = Array.prototype.pop;
            var _concat = Array.prototype.concat;
            var _join = Array.prototype.join;
            var _f_to_string = Function.prototype.toString;
            var _f_to_string_string = Function.prototype.toString.toString;
            var _f_str = Function.prototype.toString.toString();
            var _get_charcode = String.prototype.charCodeAt;
            var _promise_then = Promise.prototype.then;
            var _boolean_value_of = Boolean.prototype.valueOf;
            var _bigint_value_of;
            var _bigint_to_string;
            if (self.BigInt) {
                _bigint_value_of = BigInt.prototype.valueOf;
                _bigint_to_string = BigInt.prototype.toString;
            }
            var _get_date_time = Date.prototype.getTime;
            var _set_add = Set.prototype.add;
            var _set_delete = Set.prototype.delete;
            var _set_has = Set.prototype.has;
            var _set_get_length = Object.getOwnPropertyDescriptor(Set.prototype, "size");
            var _set_get_iterator = Set.prototype[Symbol.iterator];
            var _set_next = Object.getPrototypeOf((new Set())[Symbol.iterator]()).next;
            var _it_symbol = Symbol.iterator;
            if (_set_get_length) _set_get_length = _set_get_length.get;
            var _map_get_keys = Map.prototype.keys;
            var _map_get = Map.prototype.get;
            var _map_set = Map.prototype.set;
            var _map_delete = Map.prototype.delete;
            var _map_has = Map.prototype.has;
            var _map_get_length = Object.getOwnPropertyDescriptor(Map.prototype, "size");
            if (_map_get_length) _map_get_length = _map_get_length.get;
            var _map_key_next = Object.getPrototypeOf((new Map()).keys()[Symbol.iterator]()).next;
            var _map_get_values = Map.prototype.values;
            var _map_value_next = Object.getPrototypeOf((new Map()).values()[Symbol.iterator]()).next;
            var _map_get_entries = Map.prototype.entries;
            var _map_entry_next = Object.getPrototypeOf((new Map()).entries()[Symbol.iterator]()).next;
            var _map_array = Array.prototype.map;
            var EventTarget = self.EventTarget;
            var _event_dispatch = EventTarget ? (EventTarget.prototype.dispatchEvent ? EventTarget.prototype.dispatchEvent : null) : null;
            var _buffer_get_length = self.SharedArrayBuffer ? Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength") : null;
            if (_buffer_get_length && _buffer_get_length.get) _buffer_get_length = _buffer_get_length.get;
            else _buffer_get_length = null;
            var _text_encoder_encode = self.TextEncoder ? self.TextEncoder.prototype.encode : null;
            var _text_decoder_decode = self.TextDecoder ? self.TextDecoder.prototype.decode : null;
            var _buffer_slice = self.ArrayBuffer ? self.ArrayBuffer.prototype.slice : null;
            var _sharedbuffer_slice = self.SharedArrayBuffer ? self.SharedArrayBuffer.prototype.slice : null;
            var _array_get_iterator = Array.prototype[Symbol.iterator];
            var _array_next = Object.getPrototypeOf([][Symbol.iterator]()).next;
            var _weakset_has = self.WeakSet ? self.WeakSet.prototype.has : self.Set.prototype.has;
            var _weakset_add = self.WeakSet ? self.WeakSet.prototype.add : self.Set.prototype.add;
            var _weakset_delete = self.WeakSet ? self.WeakSet.prototype.delete : self.Set.prototype.delete;
            var _weakmap_has = self.WeakMap ? self.WeakMap.prototype.has : self.Map.prototype.has;
            var _weakmap_set = self.WeakMap ? self.WeakMap.prototype.set : self.Map.prototype.set;
            var _weakmap_get = self.WeakMap ? self.WeakMap.prototype.get : self.Map.prototype.get;
            var _weakmap_delete = self.WeakMap ? self.WeakMap.prototype.delete : self.Map.prototype.delete;
            var _typedArray = null;
            var _typedProto = null;
            var _get_typed_buffer = null;
            var _get_typed_byteOffset = null;
            var _get_typed_byteLength = null;
            if (self.Uint8Array) {
                _typedProto = Object.getPrototypeOf(self.Uint8Array.prototype);
                _typedArray = _typedProto.constructor;
                _get_typed_buffer = Object.getOwnPropertyDescriptor(_typedProto, "buffer").get;
                _get_typed_byteOffset = Object.getOwnPropertyDescriptor(_typedProto, "byteOffset").get;
                _get_typed_byteLength = Object.getOwnPropertyDescriptor(_typedProto, "byteLength").get;
            }
            root = {
                String: function (str) {
                    if (typeof str == 'string') return str;
                    else if (str instanceof _String) {
                        return apply(_s_toString, [str]);
                    } else if (typeof str == 'number' || str instanceof root.Number) {
                        return apply(_n_toString, [str]);
                    } else if (typeof str == 'boolean' || str instanceof root.Boolean) {
                        return apply(_b_toString, [str]);
                    } else if (typeof str == 'bigint' || (root.BigInt && str instanceof root.BigInt)) {
                        return apply(_bigint_to_string, [str]);
                    } else {
                        return apply(_String, [self, str]); //apply to not give the 'this' away.
                    }
                },
                self: self,
                StringType: _String,
                Number,
                Object,
                Promise,
                Function,
                Array,
                Symbol,
                Boolean,
                Error,
                WeakSet : self.WeakSet || self.Set,
                WeakMap: self.WeakMap || self.Map,
                ErrorPrototype: Error.prototype,
                TypeError,
                Set,
                Map,
                Date,
                Proxy,
                TypedArray: _typedArray,
                BigInt: self.BigInt,
                Atomics: self.Atomics,
                ArrayBuffer: self.ArrayBuffer,
                SharedArrayBuffer: self.SharedArrayBuffer,
                Int32Array: self.Int32Array,
                Uint8Array: self.Uint8Array,
                Uint32Array: self.Uint32Array,
                crossOriginIsolated: self.crossOriginIsolated,
                arrays: {
                    ArrayBuffer: self.ArrayBuffer,
                    SharedArrayBuffer: self.SharedArrayBuffer,
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
                },
                TextEncoder: self.TextEncoder,
                TextDecoder: self.TextDecoder,
                Event: self.Event,
                ErrorEvent: self.ErrorEvent,
                PromiseRejectionEvent: self.PromiseRejectionEvent,
                EventTarget: self.EventTarget,
                toStringTag: Symbol.toStringTag,
                errors: { EvalError, RangeError, ReferenceError, SyntaxError, TypeError, AggregateError: self.AggregateError, InternalError: self.InternalError, URIError: self.URIError },
                GeneratorFunction: Object.getPrototypeOf(function* () { }).constructor,
                AsyncFunction: Object.getPrototypeOf(async function () { }).constructor,
                bind: bind,
                bindFunction: bindFunction,
                apply: apply,
                undefined: self.undefined,
                NaN: self.NaN,
                Infinity: self.Infinity,
                JSON: {
                    stringify: JSON.stringify.bind(JSON),
                    parse: JSON.parse.bind(JSON)
                },
                addEventListener: bind(self.addEventListener, self),
                postMessage: bind(self.postMessage, self),
                removeEventListener: bind(self.removeEventListener, self),
                dispatchEvent: bind(self.dispatchEvent, self),
                IteratorSymbol: _it_symbol,
                util: {
                    substring(str, start, end) {
                        return apply(_substring, [str, start, end]);
                    },
                    split(str, del) {
                        return apply(_split, [str, del]);
                    },
                    includes(str, val) {
                        return apply(_includes, [str, val]);
                    },
                    indexOf(str, search) {
                        return apply(_indexOf, [str, search]);
                    },
                    startsWith(str, search) {
                        return apply(_startsWith, [str, search]);
                    },
                    arrayLength(arr) {
                        if (_getLength == undefined) {
                            return apply(_getArray, [arr]).length; //the .length is not configurable
                        } else {
                            return apply(_getLength, [arr]);
                        }
                    },
                    stringLength(str) {
                        str = root.String(str);
                        if (_str_getLength == undefined) {
                            return str.length;
                        } else {
                            return apply(_str_getLength, [str]);
                        }
                    },
                    bufferLength(buff) {
                        if (_buffer_get_length == null) {
                            return buff.byteLength; //the .byteLength is not configurable
                        } else {
                            return apply(_buffer_get_length, [buff]);
                        }
                    },
                    symbolDescription(symbol) {
                        var description;
                        if (_getDescription == undefined) {
                            description = symbol.description;
                        } else {
                            description = apply(_getDescription, [symbol]);
                        }
                        if (description == undefined) return null;
                        return description;
                    },
                    toArray(arr) {
                        return apply(_getArray, [arr]);
                    },
                    trim(str) {
                        return apply(_trim, [str]);
                    },
                    push(arr, val) {
                        return apply(_push, [arr, val]);
                    },
                    pop(arr) {
                        return apply(_pop, [arr]);
                    },
                    arrayConcat(x, y) {
                        return apply(_concat, [x, y]);
                    },
                    promiseThen(promise, x, y) {
                        return apply(_promise_then, [promise, x, y]);
                    },
                    booleanValue(bool) {
                        return apply(_boolean_value_of, [bool]);
                    },
                    bigIntValue(int) {
                        return apply(_bigint_value_of, [int]);
                    },
                    getDateTime(date) {
                        return apply(_get_date_time, [date]);
                    },
                    map: {
                        keys(map) {
                            return [...{ [_it_symbol]: () => ({ next: bind(_map_key_next, apply(_map_get_keys, [map])) }) }];
                        },
                        values(map) {
                            return [...{ [_it_symbol]: () => ({ next: bind(_map_value_next, apply(_map_get_values, [map])) }) }];
                        },
                        entries(map) {
                            return [...{ [_it_symbol]: () => ({ next: bind(_map_entry_next, apply(_map_get_entries, [map])) }) }];
                        },
                        get(map, key) {
                            return apply(_map_get, [map, key]);
                        },
                        set(map, key, value) {
                            return apply(_map_set, [map, key, value]);
                        },
                        delete(map, key) {
                            return apply(_map_delete, [map, key]);
                        },
                        has(map, key) {
                            return apply(_map_has, [map, key]);
                        },
                        size(map) {
                            return apply(_map_get_length, [map]);
                        }
                    },
                    set: {
                        values(set) {
                            return [...{ [_it_symbol]: () => ({ next: bind(_set_next, apply(_set_get_iterator, [set])) }) }];
                        },
                        add(set, value) {
                            return apply(_set_add, [set, value]);
                        },
                        delete(set, value) {
                            return apply(_set_delete, [set, value]);
                        },
                        has(set, value) {
                            return apply(_set_has, [set, value]);
                        },
                        size(set) {
                            return apply(_set_get_length, [set]);
                        }
                    },
                    mapArray(arr, func) {
                        return apply(_map_array, [arr, func]);
                    },
                    arrayIterable(arr) {
                        return { [_it_symbol]: () => ({ next: bind(_array_next, apply(_array_get_iterator, [arr])) }) };
                    },
                    dispatchEvent(target, ev) {
                        if (!_event_dispatch) return;
                        if (target === self) target = rootEventTarget;
                        if (target == null || !(target instanceof root.EventTarget)) return; //EventTarget != null cuz _event_dispatch != null
                        return apply(_event_dispatch, [target, ev]);
                    },
                    encodeText(str, encoding) {
                        return apply(_text_encoder_encode, [new root.TextEncoder(encoding), str]);
                    },
                    decodeText(data, encoding) {
                        return apply(_text_decoder_decode, [new root.TextDecoder(encoding), data]);
                    },
                    sliceBufferStart(data, start) {
                        return apply((root.SharedArrayBuffer && data instanceof root.SharedArrayBuffer) ? _sharedbuffer_slice : _buffer_slice, [data, start]);
                    },
                    sliceBuffer(data, start, end) {
                        return apply((root.SharedArrayBuffer && data instanceof root.SharedArrayBuffer) ? _sharedbuffer_slice : _buffer_slice, [data, start, end]);
                    },
                    replaceString(str, from, to) {
                        return apply(_replace_string, [str, from, to]);
                    },
                    joinArray(arr, del) {
                        return apply(_join, [arr, del]);
                    },
                    charCodeAt(str, index) {
                        return apply(_get_charcode, [str, index]);
                    },
                    typedArrayToBuffer(array) {
                        var byteOffset = apply(_get_typed_byteOffset, [array]);
                        return apply(_buffer_slice, [apply(_get_typed_buffer, [array]), byteOffset, apply(_get_typed_byteLength, [array]) + byteOffset])
                    },
                    spliceArray(arr, start, count) {
                        return apply(_splice, [arr, start, count]);
                    },
                    weakSet: {
                        add(set, value) {
                            return apply(_weakset_add, [set, value]);
                        },
                        has(set, value) {
                            return apply(_weakset_has, [set, value]);
                        },
                        delete(set, value) {
                            return apply(_weakset_delete, [set, value]);
                        }
                    },
                    weakMap: {
                        set(set, key, value) {
                            return apply(_weakmap_set, [set, key, value]);
                        },
                        has(set, key) {
                            return apply(_weakmap_has, [set, key]);
                        },
                        get(set, key) {
                            return apply(_weakmap_get, [set, key]);
                        },
                        delete(set, key) {
                            return apply(_weakmap_delete, [set, key]);
                        }
                    },
                    keys: bind(Object.keys, Object),
                    defineProperty: bind(Object.defineProperty, Object),
                    defineProperties: bind(Object.defineProperties, Object),
                    getOwnPropertyNames: bind(Object.getOwnPropertyNames, Object),
                    getOwnPropertySymbols: bind(Object.getOwnPropertySymbols, Object),
                    getOwnPropertyDescriptor: bind(Object.getOwnPropertyDescriptor, Object),
                    freezeObject: bind(Object.freeze, Object),
                    createObject: bind(Object.create, Object),
                    getPrototypeOf: bind(Object.getPrototypeOf, Object),
                    setPrototypeOf: bind(Object.setPrototypeOf, Object),
                    ObjectEqual: bind(Object.is, Object),
                    ObjectIsFrozen: bind(Object.isFrozen, Object),
                    ObjectIsSealed: bind(Object.isSealed, Object),
                    ObjectSeal: bind(Object.seal, Object),
                    ObjectPreventExtensions: bind(Object.preventExtensions, Object),
                    ObjectIsExtensible: bind(Object.isExtensible, Object),
                    ObjectAssign: bind(Object.assign, Object),
                    AtomicsWait: (self.Atomics && self.Atomics.wait) ? bind(self.Atomics.wait, Atomics) : null,
                    fromCharCode: bind(String.fromCharCode, String),
                    isNaN,
                    apply,
                    bind
                },
            }
            root.realErrors = Object.assign({Error: root.Error}, root.errors);
            var undefined = root.undefined;
            /**
             * The webworker can do more then the jailed code is privileged to do.
             * The jailed code can only execute functions from VM that only has impact on their own stuff. (like substring)
             * 
             * You can allow more by copying the values from apis.
             */
            //Temporary and persistent are constants that cannot be redefined
            var whitelist = ["Object", "Function", "Array", "Number", "parseFloat", "parseInt", "Infinity", "NaN", "undefined", "Boolean", "String", "Symbol", "Date", "Promise", "RegExp", "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "atob", "btoa", "AggregateError", "URIError", "JSON", "Math", "Intl", "ArrayBuffer", "Uint8Array", "Int8Array", "Uint16Array", "Int16Array", "Uint32Array", "Int32Array", "Float32Array", "Float64Array", "Uint8ClampedArray", "BigUint64Array", "BigInt64Array", "DataView", "Map", "BigInt", "Set", "WeakMap", "WeakSet", "Proxy", "Reflect", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", "unescape", "eval", "isFinite", "isNaN", "SharedArrayBuffer", "Atomics", "TextEncoder", "TextDecoder", "globalThis", "self", "WebAssembly", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "EventTarget", "Event", "ErrorEvent", "PromiseRejectionEvent", "onerror", "onrejectionhandled", "onunhandledrejection", "TEMPORARY", "PERSISTENT"];
            var blacklist = ["onmessage", "onmessageerror", "postMessage"];
            var root_keys = Object.getOwnPropertyNames(self).concat(Object.getOwnPropertySymbols(self) || []);
            var root_length = root_keys.length;
            var EventTarget = self.EventTarget;
            var EventTargetProto = null;
            if (EventTarget) {
                EventTargetProto = EventTarget.prototype;
                rootEventTarget = new EventTarget();
            }
            for (var i = 0; i < root_length; i++) {
                var key = root_keys[i];
                if (blacklist.includes(key)) {
                    var desc;
                    if ((desc = Object.getOwnPropertyDescriptor(self, key))) {
                        if (typeof key == 'string' && key.startsWith("on") && !desc.set) {
                            try {
                                Object.defineProperty(self, key, { get: () => undefined, set: () => { throw new root.errors.ReferenceError("You cannot add a listener for " + key); }, configurable: false, enumerable: false });
                            } catch (ex) { Promise.reject(ex); try { delete self[key] } catch (ex) { } }
                        } else {
                            try {
                                Object.defineProperty(self, key, { value: undefined, configurable: true, enumerable: false, writable: true });
                            } catch (ex) { Promise.reject(ex); }
                            try { delete self[key] } catch (ex) { }
                        }
                    }
                    continue;
                }
                if (whitelist.includes(key)) continue;
                if (key == null) continue;
                try { if (!apis[key]) apis[key] = self[key]; } catch (ex) { }
                var desc;
                if ((desc = Object.getOwnPropertyDescriptor(self, key))) {
                    if (typeof key == 'string' && key.startsWith("on")) {
                        if (desc.set) {
                            ((key, desc) => {
                                var ev = key.substr(2);
                                var me = self;
                                var copy = { get: desc.get, set: desc.set, enumerable: false, configurable: true };
                                if (!apiEvents[ev]) apiEvents[ev] = { desc: copy, allowed: false, allow: () => { if (apiEvents[ev].allowed) return; root.util.defineProperty(me, key, copy); apiEvents[ev].allowed = true; registerRootListener(ev); } };
                            })(key, desc);
                        } else {
                            (key => {
                                var ev = key.substr(2);
                                if (!apiEvents[ev]) apiEvents[ev] = { desc, allowed: false, allow: () => { if (apiEvents[ev].allowed) return; apiEvents[ev].allowed = true; registerRootListener(ev); } };
                                try {
                                    var val = undefined;
                                    Object.defineProperty(self, key, { get: () => val, set: v => { if (!apiEvents[key].allowed) throw new root.errors.ReferenceError("You cannot add a listener for " + key); val = v; }, enumerable: false, configurable: false });
                                } catch (ex) { Promise.reject(ex); try { delete self[key]; } catch (ex) { } }
                            })(key);
                            continue;
                        }
                    }
                    try {
                        Object.defineProperty(self, key, { value: undefined, configurable: true, enumerable: false, writable: true });
                    } catch (ex) { Promise.reject(ex); }
                    try { delete self[key] } catch (ex) { }
                }

            }
            //prototype chain bug. if you delete a property, the prototype property is not deleted so you have access to that.
            var proto = self;
            var hasEvent = false;
            while (proto && proto != Object.prototype) {
                try {
                    Object.setPrototypeOf(proto, Object.prototype);
                    break;
                } catch (ex) {
                    proto = Object.getPrototypeOf(proto);
                    if (proto == EventTargetProto) {
                        hasEvent = true;
                        proto = Object.getPrototypeOf(proto);
                    }
                    if (!proto || proto == Object.prototype) break;
                    root_keys = Object.getOwnPropertyNames(proto).concat(Object.getOwnPropertySymbols(proto) || []);
                    root_length = root_keys.length;
                    for (var i = 0; i < root_length; i++) {
                        var key = root_keys[i];
                        if (key == null) continue;
                        if (whitelist.includes(key)) continue;
                        var desc;
                        try { if (!apis[key]) apis[key] = proto[key]; } catch (ex) { try { if (!apis[key]) apis[key] = self[key] } catch (ex) { } }
                        if ((desc = Object.getOwnPropertyDescriptor(proto, key))) {
                            if (typeof key == 'string' && key.startsWith("on")) {
                                if (desc.set) {
                                    ((key, desc) => {
                                        var ev = key.substr(2);
                                        var me = self;
                                        var copy = { get: desc.get, set: desc.set, enumerable: false, configurable: true };
                                        if (!apiEvents[ev]) apiEvents[ev] = { desc: copy, allowed: false, allow: () => { if (apiEvents[ev].allowed) return; root.util.defineProperty(me, key, copy); apiEvents[ev].allowed = true; registerRootListener(ev); } };
                                    })(key, desc);
                                } else {
                                    (key => {
                                        var ev = key.substr(2);
                                        if (!apiEvents[ev]) apiEvents[ev] = { desc, allowed: false, allow: () => { if (apiEvents[ev].allowed) return; apiEvents[ev].allowed = true; registerRootListener(ev); } };
                                        try {
                                            var val = undefined;
                                            Object.defineProperty(self, key, { get: () => val, set: v => { if (!apiEvents[key].allowed) throw new root.errors.ReferenceError("You cannot add a listener for " + key); val = v; }, configurable: true, enumerable: false });
                                        } catch (ex) { Promise.reject(ex); try { delete self[key]; } catch (ex) { } }
                                    })(key);
                                    continue;
                                }
                            }
                            try {
                                Object.defineProperty(proto, key, { value: undefined, configurable: true, enumerable: false, writable: true });
                            } catch (ex) { Promise.reject(ex); }
                            try { delete proto[key] } catch (ex) { }
                        }
                    }
                }
            }
            proto = Object.getPrototypeOf(self);
            if (proto == Object.prototype) self[Symbol.toStringTag] = "JailedGlobal";
            else proto[Symbol.toStringTag] = "JailedGlobal";
            if (hasEvent) {
                proto = EventTargetProto;
                root_keys = Object.getOwnPropertyNames(proto).concat(Object.getOwnPropertySymbols(proto) || []);
                root_length = root_keys.length;
                for (var i = 0; i < root_length; i++) {
                    var key = root_keys[i];
                    if (key == null || key == 'constructor') continue;
                    if (whitelist.includes(key)) continue;
                    var old = proto[key];
                    if (key == "addEventListener" || key == "removeEventListener" || key == "dispatchEvent") {
                        if (old && EventTargetProto.dispatchEvent && key == "addEventListener") {
                            ((add, dispatch) => {
                                if (!add || !dispatch) return;
                                var reg = [];
                                registerRootListener = name => {
                                    name = name + '';
                                    if (name == 'message' || name == 'messageerror') return;
                                    if (reg.includes(name)) return;
                                    add(name, e => {
                                        try {
                                            dispatch(e);
                                        }catch(ex) {}
                                    });
                                    reg[root.util.arrayLength(reg)] = name;
                                };
                                registerRootListener("error");
                                registerRootListener("rejectionhandled");
                                registerRootListener("unhandledrejection");
                            })(root.bind(old, self), root.bind(EventTargetProto.dispatchEvent, rootEventTarget));
                        }
                        if (old) {
                            ((proto, key, old) => {
                                var old_name = old.toString();
                                var old_to_str = old.toString.toString();
                                proto[key] = function (...args) {
                                    if (this === self) return root.apply(old, root.util.arrayConcat([rootEventTarget], args));
                                    else return root.apply(old, root.util.arrayConcat([this], args));
                                }
                                proto[key].toString = () => old_name;
                                proto[key].toString[Symbol.toStringTag] = old_to_str;
                            })(proto, key, old);
                            continue;
                        }
                    }
                    try { if (!apis[key]) apis[key] = proto[key]; } catch (ex) { }
                    if (Object.getOwnPropertyDescriptor(proto, key)) {
                        try {
                            Object.defineProperty(proto, key, { value: undefined, configurable: true, enumerable: false, writable: true });
                        } catch (ex) { Promise.reject(ex); }
                        try { delete proto[key]; } catch (ex) { }
                    }
                }
                var messagedesc = Object.getOwnPropertyDescriptor(self, "onmessage");
                if (messagedesc == null || messagedesc.configurable) {
                    var list = null;
                    Object.defineProperty(self, "onmessage", { get: () => list, set: val => list = val, enumerable: false, configurable: true });
                    rootEventTarget.addEventListener('message', e => list ? list(e) : null);

                }
            }
            //edits to apis is allowed.
        })();

        /* 
            We won't let the malicous code manage any communication between jail and the main program.
            So we delete any communication function from the global scope, while we coppied these functions
            in the 'root' object.
        */



        var data;
        var util = root.util;
        var imports = {
            /*
            numToText: function (num) {
                var t = '';
                for (var i = 0; i < 5; i++) {
                    t += util.fromCharCode(35 + (num % 85));
                    num = ~~(num / 85);
                }
                return t;
            },*/
            textToNum: function (text) {
                text = root.String(text);
                if (util.stringLength(text) != 5) throw new root.errors.TypeError("text length must be 5");
                var n = 0;
                for (var i = 4; i >= 0; i--) {
                    if (i < 4) n *= 85;
                    n += util.charCodeAt(text, i) - 35;
                }
                return n;

            },
            /*
            binToCompressedText: function (data) {
                if (!(data instanceof root.ArrayBuffer) && (!root.SharedArrayBuffer || !(data instanceof root.SharedArrayBuffer))) {
                    if(!(data instanceof root.TypedArray)) throw root.errors.TypeError("Data needs to be an ArrayBuffer or TypedArray.");
                    data = util.typedArrayToBuffer(data);
                }
                var len = util.bufferLength(data);
                var ints = ~~(len / 4);
                var rem = len % 4;
    
                var res = new root.Array(ints + 1);
                res[0] = ''
                var arr = new root.Uint32Array(root.sliceBuffer(data, 0, ints * 4));
                for (var i = 0; i < ints; i++) {
                    res[i] = imports.numToText(arr[i]);
                }
                if (rem > 0) {
                    arr = new root.Uint8Array(root.sliceBufferStart(data, (ints * 4)));
                    var num = 0;
                    //endianess worker == endianess host
                    var narr = new root.ArrayBuffer(4);
                    var z = new root.Uint8Array(narr);
                    for (var i = 0; i < (4 - rem); i++) z[i] = arr[i];
                    var num = (new root.Uint32Array(narr))[0];
                    var mnum = 256 * rem;
                    while (num < mnum) num *= 256;
                    res[ints] = imports.numToText(num);
                } else res[ints] = '';
                return util.joinArray(res, '');
            },*/
            compressedTextToBin: function (cons, txt) {
                txt = root.String(txt);
                var len = util.stringLength(txt);
                if (len % 5 != 0) throw new root.errors.TypeError("txt must be a multiple of 5");
                var data = new cons((len / 5) * 4);
                var arr = new root.Uint32Array(data);
                for (var i = 0; i < (len / 5); i++) {
                    arr[i] = imports.textToNum(util.substring(txt, i * 5, (i + 1) * 5));
                }
                return data;
            },
            valueToMessage: function (value) {
                var valueToMessage = imports.valueToMessage;
                var isStatic = value instanceof StaticType;
                var deep = false;
                if (isStatic) {
                    deep = value.deep;
                    value = value.value;
                }
                var Array = root.Array;
                var String = root.String;
                var StringType = root.StringType;
                var Object = root.Object;
                var Boolean = root.Boolean;
                var Number = root.Number;
                var BigInt = root.BigInt;
                var Promise = root.Promise;
                var Symbol = root.Symbol;
                var JSON = root.JSON;
                var Error = root.Error;
                var errors = root.errors;
                var undefined = root.undefined;
                var self = root.self;
                var Infinity = root.Infinity;
                var NaN = root.NaN;
                var Map = root.Map;
                var Set = root.Set;
                var Date = root.Date;
                index = JSON.stringify(index);
                if (typeof value == 'undefined') {
                    return 'undefined';
                } else if (value == null) {
                    return 'null';
                } else if (value === self) {
                    return 'self';
                } else if (typeof value == 'number' || typeof value == 'string' || typeof value == 'boolean') {
                    if (typeof value == 'number' && util.isNaN(value)) {
                        return "NaN";
                    } else if (value == Infinity) {
                        return 'Infinity';
                    } else if (value == -Infinity) {
                        return 'Infinity_negative';
                    } else {
                        return JSON.stringify(value);
                    }
                } else if (typeof value == 'bigint') {
                    return 'BigInt(' + JSON.stringify(String(value)) + ')';
                } else if (typeof value == 'function') {
                    var index = null;
                    var objkeys = util.keys(data.objs);
                    var objlen = util.arrayLength(objkeys);
                    for (var i = 0; i < objlen; i++) {
                        var key = objkeys[i];
                        if (data.objs[key] == value) {
                            index = key;
                            break;
                        }
                    }
                    if (index == null) {
                        index = data.count++;
                        data.objs[index] = value;
                    }
                    if (isStatic) {
                        return "WrapperFunction(" + String(index) + ")";
                    } else {
                        return "Function(" + String(index) + ")";
                    }
                } else if (typeof value == 'symbol') {
                    var objkeys = util.keys(data.objs);
                    var objlen = util.arrayLength(objkeys);
                    for (var i = 0; i < objlen; i++) {
                        var key = objkeys[i];
                        if (data.objs[key] === value) {
                            return "Symbol(" + String(key) + "," + JSON.stringify(util.symbolDescription(value)) + ")";
                        }
                    }
                    var index = data.count++;
                    data.objs[index] = value;
                    return "Symbol(" + String(index) + "," + JSON.stringify(util.symbolDescription(value)) + ")";
                } else if (typeof value == 'boolean') {
                    return value ? 'true' : 'false';
                } else if (value instanceof Symbol) {
                    var primitive = value.valueOf();
                    var p_index = null;
                    var objkeys = util.keys(data.objs);
                    var objlen = util.arrayLength(objkeys);
                    for (var i = 0; i < objlen; i++) {
                        var key = objkeys[i];
                        if (data.objs[key] === primitive) {
                            p_index = key;
                            break;
                        }
                    }
                    if (p_index == null) {
                        p_index = data.count++;
                        data.objs[p_index] = primitive;
                    }
                    if (isStatic) {
                        var str = "SymbolObject(" + String(p_index) + "," + JSON.stringify(util.symbolDescription(primitive)) + ",{";
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = data.count++;
                        data.objs[index] = value;
                        return "SymbolObject(" + String(p_index) + "," + JSON.stringify(util.symbolDescription(primitive)) + "," + String(index) + ")";
                    }
                } else if (value instanceof StringType) {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = "String(" + JSON.stringify(String(value)) + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "String(" + String(index) + "," + JSON.stringify(String(value)) + ")";
                    }
                } else if (value instanceof Number) {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = "Number(" + String(value) + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Number(" + String(index) + "," + String(value) + ")";
                    }
                } else if (BigInt && value instanceof BigInt) {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = "BigIntObject(" + JSON.stringify(String(value)) + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "BigIntObject(" + String(index) + "," + JSON.stringify(String(value)) + ")";
                    }
                } else if (value instanceof Date) {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = "Date(" + String(util.getDateTime(value)) + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Date(" + String(index) + "," + String(util.getDateTime(value)) + ")";
                    }
                } else if (value instanceof Boolean) {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = "Boolean(" + (util.booleanValue(value) ? 'true' : 'false') + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Boolean(" + String(index) + "," + (util.booleanValue(value) ? 'true' : 'false') + ")";
                    }
                } else if (value instanceof Promise) {
                    var index = null;
                    var objkeys = util.keys(data.objs);
                    var objlen = util.arrayLength(objkeys);
                    for (var i = 0; i < objlen; i++) {
                        var key = objkeys[i];
                        if (data.objs[key] === value) {
                            index = key;
                            break;
                        }
                    }
                    if (index == null) index = data.count++;
                    data.objs[index] = value;
                    if (isStatic) {
                        return "WrapperPromise(" + String(index) + ")";
                    } else {
                        return "Promise(" + String(index) + ")";
                    }
                } else if (value instanceof Array) {
                    if (isStatic) {
                        var str = "["
                        var len = util.arrayLength(value);
                        for (var i = 0; i < len; i++) {
                            if (i > 0) str += ',';
                            str += "" + valueToMessage(deep ? new StaticType(value[i], true) : value[i]) + "";
                        }
                        return str + ']';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Array(" + String(index) + ')';
                    }
                } else if (value instanceof Error) {
                    try { data.errorParseStack(value); } catch(ex) {}
                    var typeName = 'Error';
                    for (var name in errors) {
                        try {
                            if (value instanceof errors[name]) {
                                typeName = String(name);
                                break;
                            }
                        } catch (e) { }
                    }
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = '{';
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        try {
                            return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify(String(value.name)) + "," + JSON.stringify(String(value.message)) + "," + JSON.stringify(String(value.stack)) + "," + str + '})';
                        } catch (ex) {
                            try {
                                return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify(String(value.name)) + "," + JSON.stringify(String("No message from this error")) + "," + JSON.stringify(String("No stack from this error")) + "," + str + '})';
                            } catch (e) {
                                return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify("No name for this error") + "," + JSON.stringify("No message from this error") + "," + JSON.stringify("No stack from this error") + "," + str + "})";
                            }
                        }
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        try {
                            return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify(String(value.name)) + "," + JSON.stringify(String(value.message)) + "," + JSON.stringify(String(value.stack)) + "," + String(index) + ')';
                        } catch (ex) {
                            try {
                                return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify(String(value.name)) + "," + JSON.stringify(String("No message from this error")) + "," + JSON.stringify(String("No stack from this error")) + "," + String(index) + ')';
                            } catch (e) {
                                return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify("No name for this error") + "," + JSON.stringify("No message from this error") + "," + JSON.stringify("No stack from this error") + "," + String(index) + ")";
                            }
                        }
                    }
                } else if (
                    root.Uint8Array &&
                    (
                        (root.ArrayBuffer && value instanceof root.ArrayBuffer) ||
                        value instanceof root.arrays.Uint8Array ||
                        value instanceof root.arrays.Uint16Array ||
                        value instanceof root.arrays.Uint32Array ||
                        value instanceof root.arrays.Int8Array ||
                        value instanceof root.arrays.Int16Array ||
                        value instanceof root.arrays.Int32Array ||
                        value instanceof root.arrays.Float32Array ||
                        value instanceof root.arrays.Float64Array ||
                        (root.arrays.BigUint64Array && value instanceof root.arrays.BigUint64Array) ||
                        (root.SharedArrayBuffer && value instanceof root.SharedArrayBuffer)
                    )) {
                    var str;
                    var index = null;
                    var objkeys = util.keys(data.objs);
                    var objlen = util.arrayLength(objkeys);
                    for (var i = 0; i < objlen; i++) {
                        var key = objkeys[i];
                        if (data.objs[key] === value) {
                            index = key;
                            break;
                        }
                    }
                    if (isStatic && !root.crossOriginIsolated && root.SharedArrayBuffer && value instanceof root.SharedArrayBuffer) {
                        var len = root.util.bufferLength(value);
                        var v = new root.ArrayBuffer(len);
                        var y = new root.Uint8Array(v);
                        var z = new root.Uint8Array(value);
                        for (var i = 0; i < len; i++) {
                            y[i] = z[i];
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        root.postMessage({ index, value: v, buffer: true }); //always post because it is not synced (crossOriginIsolated == false and not posted as Shared)
                        if (!isStatic) return "SharedBuffer(" + index + ")";
                        str = 'SharedBuffer(' + index + ',{';
                    } else {
                        //only post if a) is resolved and b) is not synced unless it is a new value. 
                        //so a shared array buffer is not posted twice.
                        if (isStatic && (index == null || !root.SharedArrayBuffer || !(value instanceof root.SharedArrayBuffer))) {
                            if (index == null) index = data.count++;
                            root.postMessage({ index, value, buffer: true });
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        if (!isStatic) return "Buffer(" + index + ")";
                        str = 'Buffer(' + index + ',{';
                    }
                    var keys = util.keys(value);
                    var len = util.arrayLength(keys);
                    var first = true;
                    for (var i = 0; i < len; i++) {
                        var key = keys[i];
                        if (key == undefined) continue;
                        if (!util.isNaN(root.Number(key))) continue;
                        var v = undefined;
                        try { v = value[key]; } catch (ex) { }
                        if (!first) str += ',';
                        str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        first = false;
                    }
                    return str + '})';
                } else if (value instanceof Set) {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var info = util.set.values(value);
                        var str = "Set(" + valueToMessage(new StaticType(info, deep)) + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Set(" + String(index) + ")";
                    }
                } else if (value instanceof Map) {
                    if (isStatic) {
                        var keys = util.map.keys(value);
                        var len = util.arrayLength(keys);
                        var arr = [];
                        var x = 0;
                        for (var i = 0; i < len; i++) {
                            arr[x++] = new StaticType([keys[i], util.map.get(value, keys[i])], deep);
                        }
                        keys = util.keys(value);
                        len = util.arrayLength(keys);
                        var str = "Map(" + valueToMessage(new StaticType(arr, false)) + ",{";
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '})';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Map(" + String(index) + ")";
                    }
                } else {
                    if (isStatic) {
                        var keys = util.keys(value);
                        var len = util.arrayLength(keys);
                        var str = '{';
                        for (var i = 0; i < len; i++) {
                            var key = keys[i];
                            if (key == undefined) continue;
                            var v = undefined;
                            try { v = value[key]; } catch (ex) { }
                            if (i > 0) str += ',';
                            str += valueToMessage(key) + ':' + valueToMessage(deep ? new StaticType(v, true) : v);
                        }
                        return str + '}';
                    } else {
                        var index = null;
                        var objkeys = util.keys(data.objs);
                        var objlen = util.arrayLength(objkeys);
                        for (var i = 0; i < objlen; i++) {
                            var key = objkeys[i];
                            if (data.objs[key] === value) {
                                index = key;
                                break;
                            }
                        }
                        if (index == null) index = data.count++;
                        data.objs[index] = value;
                        return "Object(" + String(index) + ")";
                    }
                }

            },
            messageToValue: function (type, index, value) {
                var valueToMessage = imports.valueToMessage;
                var Promise = root.Promise;
                var Error = root.Error;
                var errors = root.errors;
                var String = root.String;
                var Map = root.Map;
                var util = root.util;
                if (index in data.objs && type != 'error') return data.objs[index];
                if (type == 'function') {
                    var callFunctionAsyncInMain = function (a) {
                        var findex = data.functionReturnIndex++;
                        var str = 'Call(' + index + ',' + findex + ',' + valueToMessage(this);
                        var args = util.toArray(a);
                        for (var i = 0; i < util.arrayLength(args); i++) {
                            str += ',' + valueToMessage(args[i]);
                        }
                        str += ')';
                        root.postMessage(str);
                        return new Promise(function (resolve, reject) {
                            data.functionReturns[findex] = {resolve, reject};
                        });
                    };
                    //we do this so that the code from (callFunctionInMain) is not exposed by toString
                    var r = function JailedFunction() {
                        return callFunctionAsyncInMain(arguments);
                    }
                    if (typeof value == 'object' && typeof value.name == 'string') {
                        try {
                            util.defineProperty(r, "name", {
                                configurable: true,
                                enumerable: false,
                                writable: false,
                                value: value.name
                            });
                        } catch (ex) { }
                    }
                    util.defineProperty(r, "isJailAPI", {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: true
                    });
                    util.defineProperty(r, "isSynchronous", {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: false
                    });
                    util.defineProperty(r, 'toString', {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: jailed_to_string
                    });
                    util.defineProperty(r, 'isVoid', {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: false
                    });
                    data.objs[index] = r;
                    return r;
                } else if (type == 'voidfunction') {
                    var callFunctionVoidInMain = function (a) {
                        var str = 'CallVoid(' + index + ',' + valueToMessage(this);
                        var args = util.toArray(a);
                        for (var i = 0; i < util.arrayLength(args); i++) {
                            str += ',' + valueToMessage(args[i]);
                        }
                        str += ')';
                        root.postMessage(str);
                    };
                    //we do this so that the code from (callFunctionInMain) is not exposed by toString
                    var r = function JailedFunction() {
                        return callFunctionVoidInMain(arguments);
                    }
                    if (typeof value == 'object' && typeof value.name == 'string') {
                        try {
                            util.defineProperty(r, "name", {
                                configurable: true,
                                enumerable: false,
                                writable: false,
                                value: value.name
                            });
                        } catch (ex) { }
                    }
                    util.defineProperty(r, "isJailAPI", {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: true
                    });
                    util.defineProperty(r, "isSynchronous", {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: false
                    });
                    util.defineProperty(r, 'toString', {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: jailed_to_string
                    });
                    util.defineProperty(r, 'isVoid', {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: true
                    });
                    data.objs[index] = r;
                    return r;
                } else if (type == 'syncfunction') {
                    var callFunctionSyncInMain = function (a) {
                        if (data.sharedBuffer == null) throw new Error("Synchronous API is disabled");
                        var str = 'CallSync(' + index + ',' + valueToMessage(this);
                        var args = util.toArray(a);
                        for (var i = 0; i < util.arrayLength(args); i++) {
                            str += ',' + valueToMessage(args[i]);
                        }
                        str += ')';
                        var arr = new root.Int32Array(data.sharedBuffer);
                        data.sharedValue = arr[0];
                        root.postMessage(str);

                        util.AtomicsWait(arr, 0, data.sharedValue);
                        data.sharedValue = arr[0];
                        var len = arr[1];
                        var left = len;
                        var block = util.bufferLength(data.sharedBuffer) - 8;
                        var txt = new root.Uint8Array(new root.ArrayBuffer(len));
                        var read = 0;
                        while (1) {
                            var rlen = left;
                            if (rlen > block) rlen = block;
                            var r = new root.Uint8Array(util.sliceBuffer(data.sharedBuffer, 8, 8 + rlen));
                            for (var i = 0; i < rlen; i++) {
                                txt[i + read] = r[i];
                            }
                            read += rlen;
                            left -= rlen;
                            if (left < 1) break;
                            data.sharedValue = arr[0];
                            root.postMessage("next");
                            util.AtomicsWait(arr, 0, data.sharedValue);
                            data.sharedValue = arr[0];
                        }
                        try {
                            return root.apply(new root.Function(util.decodeText(txt, 'utf-8')), [data]);
                        } catch (ex) {
                            throw ex; //error in synchronous jail api
                        }
                    };
                    //we do this so that the code from (callFunctionInMain) is not exposed by toString
                    var r = function JailedFunction() {
                        return callFunctionSyncInMain(arguments);
                    }
                    if (typeof value == 'object' && typeof value.name == 'string') {
                        try {
                            util.defineProperty(r, "name", {
                                configurable: true,
                                enumerable: false,
                                writable: false,
                                value: value.name
                            });
                        } catch (ex) { }
                    }
                    util.defineProperty(r, "isJailAPI", {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: true
                    });
                    util.defineProperty(r, "isSynchronous", {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: true
                    });
                    util.defineProperty(r, 'toString', {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: jailed_to_string
                    });
                    util.defineProperty(r, 'isVoid', {
                        configurable: true,
                        enumerable: false,
                        writable: false,
                        value: false
                    });
                    data.objs[index] = r;
                    return r;
                } else if (type == 'promise') {
                    var pr = new Promise(function (resolve, reject) {
                        var ind = data.count++;
                        data.count += 2;
                        data.objs[ind] = function (r) {
                            resolve(r);
                            delete data.objs[ind];
                            delete data.objs[ind + 1];
                        };
                        data.objs[ind + 1] = function (r) {
                            reject(r);
                            delete data.objs[ind];
                            delete data.objs[ind + 1];
                        };
                        root.postMessage('RegisterPromise(' + String(index) + ',' + String(ind) + ',' + String(ind + 1) + ')');
                    });
                    data.objs[index] = pr;
                    return pr;
                } else if (type == 'error') {
                    value = index;
                    var cls = errors[value.type];
                    if (!cls) cls = Error;
                    var err = new cls(value.message);
                    try {
                        err.name = err.name;
                        err.main_stack = value.stack;
                        err.toString = () => err.stack + '\r\n' + value.stack;
                        err.toString.toString = () => "function toString() { [native code] }";
                    } catch (ex) { }
                    return err;
                } else if (type == 'map') {
                    value = index;
                    var len = util.arrayLength(value);
                    var map = new Map();
                    for (var i = 0; i < len; i++) {
                        var item = value[i];
                        util.map.set(map, item[0], item[1]);
                    }
                    return map;
                } else return value;
            }
        };

        (function () {
            /* Imports from global, this prevents any overwrites */
            var addEventListener = root.addEventListener;
            var postMessage = root.postMessage;
            var String = root.String;
            var StringType = root.StringType;
            var Function = root.Function;
            var SharedArrayBuffer = root.SharedArrayBuffer;
            var Atomics = root.Atomics;
            var AsyncFunction = root.AsyncFunction;
            var GeneratorFunction = root.GeneratorFunction;
            var Symbol = root.Symbol;
            var JSON = { parse: root.JSON.parse, stringify: root.JSON.stringify };
            var Array = root.Array;
            var Event = root.Event;
            var Proxy = root.Proxy;
            var WeakSet = root.WeakSet;
            var WeakMap = root.WeakMap;
            var util = root.util;
            var bind = root.bind;
            var apply = root.apply;
            var undefined = root.undefined;
            var self = root.self;
            var errorsSanitized = false;

            var parser = (() => function ParseJailedCode(code) {
                return new Function(code);
            })();
            util.defineProperty(parser, "name", {configurable: false, writable: false, value: 'ParseJailedCode' + jailID});
            var parserAsync = (() => function ParseJailedCode(code) {
                return new AsyncFunction(code);
            })();
            util.defineProperty(parserAsync, "name", {configurable: false, writable: false, value: 'ParseJailedCode' + jailID});
            var parserGenerator = (() => function ParseJailedCode(code) {
                return new AsyncFunction(code);
            })();
            util.defineProperty(parserGenerator, "name", {configurable: false, writable: false, value: 'ParseJailedCode' + jailID});

            /* Root for the code from the messages */
            data = {
                self: self,
                objs: { 0: self, 1: apis, 2: apiEvents },
                global: self,
                count: 3,
                snippets: {},
                postMessage: postMessage,
                wrap: imports.messageToValue,
                jailedCode,
                root,
                util,
                global_eval,
                apis,
                apiEvents,
                registerRootListener,
                rootEventTarget,
                postedObj: [],
                sharedBuffer: null,
                sharedValue: 0,
                functionReturns: {},
                functionReturnIndex: 0,
                errorParseStack: () => {},
                stackParsed: null,
                errorStacks: null,
                symbol(x, y) {
                    if (x in data.objs) return data.objs[x];
                    else {
                        var s;
                        if (y == undefined) s = Symbol();
                        else s = Symbol(y);
                        data.objs[x] = s;
                        return s;
                    }
                },
                static(x, y) {
                    if (y == undefined) y = true;
                    if (typeof x == 'object' || typeof x == 'function') {
                        return new StaticType(x, y);
                    } else {
                        return x;
                    }
                },
                whitelist(x) {
                    if (!(x instanceof Array)) {
                        x = [x];
                    }
                    var len = util.arrayLength(x);
                    var didall = true;
                    for (var i = 0; i < len; i++) {
                        var key = x[i];
                        if (!(typeof key == 'string')) {
                            didall = false;
                            continue;
                        }
                        if (!(key in apis)) {
                            didall = false;
                            continue;
                        }
                        if (key in self) continue;
                        this.util.defineProperty(self, key, { configurable: true, enumerable: false, writable: true, value: apis[key] })
                    }
                    return didall;
                },
                whitelistEvent(x) {
                    if (!(x instanceof Array)) x = [x];
                    var len = util.arrayLength(x);
                    var didall = true;
                    for (var i = 0; i < len; i++) {
                        var key = x[i];
                        if (!(typeof key == 'string')) {
                            didall = false;
                            continue;
                        }
                        if (!(key in apiEvents)) {
                            registerRootListener(key);
                        } else {
                            if (apiEvents[key].allowed) continue;
                            apiEvents[key].allow();
                        }
                    }
                    return didall;
                },
                enableSynchronousAPI() {
                    if (SharedArrayBuffer == null || Atomics == null || root.TextDecoder == null) throw new root.errors.TypeError("Synchronous API not supported in worker");
                    var obj = data.getLastObj();
                    if (obj == null) throw new root.errors.TypeError("No Shared buffer given.")
                    if (!(obj instanceof SharedArrayBuffer)) throw new root.errors.TypeError("Must be a SharedArrayBuffer");
                    data.sharedBuffer = obj;
                    return true;
                },
                disableSynchronousAPI() {
                    data.sharedBuffer = null;
                    return true;
                },
                postMessage(message) {
                    var ev = new Event('message');
                    ev.data = message;
                    util.dispatchEvent(rootEventTarget, ev);
                    return null;
                },
                getLastObj() {
                    return util.pop(data.postedObj);
                },
                fromTypedArray(name, len, txt) {
                    var cls = root.arrays[name];
                    if (!cls) throw root.errors.TypeError("Unknown binary Array type " + cls);
                    var cons = root.ArrayBuffer;
                    if (name == "SharedArrayBuffer") cons = cls;
                    var arr = util.sliceBuffer(imports.compressedTextToBin(cons, txt), 0, len);
                    if (name != "SharedArrayBuffer" && name != "ArrayBuffer") arr = new cls(arr);
                    return arr;
                },
                sanitizeErrors() {
                    if(errorsSanitized) return false;
                    var doneErrors = new WeakSet();
                    data.stackParsed = doneErrors;
                    var errorStacks = new WeakMap();
                    data.errorStacks = errorStacks;

                    function JailParseStack(err) {
                        try {
                            if(!(err instanceof root.realErrors.Error)) return;
                            if(util.weakSet.has(doneErrors, err)) return err.stack;
                            util.weakSet.add(doneErrors, err);
                            var lines = util.split(err.stack, '\n');
                            var linesLength = util.arrayLength(lines);
                            var start = null;
                            var end = null;
                            var preserveStart = false;
                            for(var x = 0; x < linesLength; x++) {
                                var line = lines[x];
                                if(x == 0 && !util.startsWith(line, " ")) {
                                    preserveStart = true;
                                    continue;
                                }
                                var test = util.split(line, " at ");
                                var testLength = util.arrayLength(test);
                                if(testLength > 1 && util.trim(test[0]) == "") {
                                    test = util.trim(test[1]);
                                } else {
                                    test = util.trim(util.split(line, "@")[0]);
                                }

                                if(start == null) {
                                    if(
                                        util.startsWith(test, "JailCreateError") || 
                                        util.includes(test, ".JailCreateError") || 
                                        util.includes(test, "(JailCreateError") ||
                                        util.includes(test, "at JailCreateError")
                                    ) {
                                        start = x;
                                    }
                                }
                                
                            }
                            for(var x = linesLength - 1; x >= 0; x--) {
                                var line = lines[x];
                                var test = util.split(line, " at ");
                                var testLength = util.arrayLength(test);
                                if(testLength > 1 && util.trim(test[0]) == "") {
                                    test = util.trim(test[1]);
                                } else {
                                    test = util.split(line, "@");
                                    testLength = util.arrayLength(test);
                                    if(testLength > 1) {
                                        test = util.trim(test[1]);
                                    } else {
                                        test = util.trim(test[0]);
                                    }
                                }
                                if(end == null) {
                                    if(
                                        util.startsWith(test, "RunJailedCode" + jailID) || 
                                        util.startsWith(test, "ParseJailedCode" + jailID) || 
                                        util.includes(test, ".RunJailedCode" + jailID) ||
                                        util.includes(test, ".ParseJailedCode" + jailID) || 
                                        util.includes(test, "(RunJailedCode" + jailID) ||
                                        util.includes(test, "(ParseJailedCode" + jailID) ||
                                        util.includes(test, "at RunJailedCode" + jailID) ||
                                        util.includes(test, "at ParseJailedCode" + jailID)
                                    ) {
                                        end = x;
                                        break;
                                    }
                                }
                            }
                            util.spliceArray(lines, preserveStart ? 1 : 0, start + (preserveStart ? 0 : 1));
                            if(end != null) {
                                if(start != null) {
                                    end -= start;
                                    linesLength -= start;
                                }
                                if(end && (util.includes(lines[end - 1], "<anonymous>") || util.includes(lines[end - 1], "(anonymous)") || util.includes(lines[end - 1], "@anonymous"))) {
                                    end--;
                                }
                                util.spliceArray(lines, end, linesLength - end);
                            }
                            util.defineProperty(err, "stack", {value: util.joinArray(lines, '\n'), writable: true, configurable: true, enumerable: false});
                            return util.joinArray(lines, '\n');
                        } catch(ex) {}
                        return stack;
                    }
                    data.errorParseStack = JailParseStack;

                    var createError = (() => function JailCreateError(target, argArray) {
                        var err = new target(...util.arrayIterable(argArray));
                        JailParseStack(err);
                        return err;
                    })();

                    var names = util.getOwnPropertyNames(self);
                    var namesLen = util.arrayLength(names);
                    for(var i = 0; i < namesLen; i++) {
                        var name = names[i];
                        try {
                            var ourError = true;
                            var err = root.realErrors[name];
                            if(!err) {
                                try {
                                    err = self[name];
                                } catch(ex) {continue;}
                                ourError = false;
                            }
                            if(!err || typeof err != 'function') continue;
                            var proto = err.prototype;
                            if(err != root.realErrors.Error && !(proto instanceof root.realErrors.Error)) continue;
                            var prox = new Proxy(err, {construct: createError, apply: function JailCreateError(target, thisArg, args) {
                                return createError(target, thisArg, args);
                            }});
                            if(ourError) {
                                if(name == 'Error') {
                                    root[name] = prox;
                                } else if(name == 'TypeError') {
                                    root[name] = prox;
                                    root.errors[name] = prox;
                                } else {
                                    root.errors[name] = prox;
                                }
                            }
                            try {
                                util.defineProperty(proto, 'constructor', {value: prox, enumerable: false, configurable: true, writable: true});
                            } catch(ex) {}
                            util.defineProperty(self, name, {value: prox, configurable: true, writable: true, enumerable: false});
                            
                        } catch(ex) {}
                    }
                    var proto = root.ErrorPrototype;
                    ((proto, oldToString, oldDesc) => {
                        util.defineProperty(proto, 'toString', {value: function() {
                            JailParseStack(this);
                            return apply(oldToString, [this]);
                        }, writable: true, configurable: true, enumerable: false});
                        util.defineProperty(proto, 'stack', {get() {
                            if(oldDesc && oldDesc.get) return apply(oldDesc.get, [this]);
                            else {
                                if(!this || typeof this != 'object') return null;
                                return util.weakMap.get(errorStacks, this) || null;
                            }
                        }, set(value) {
                            if(oldDesc && oldDesc.set) {
                                var ret = apply(oldDesc.set, [this, value]);
                                JailParseStack(this);
                                return ret;
                            }
                            else {
                                if(!this || typeof this != 'object') return null;
                                util.weakMap.set(errorStacks, this, value);
                                JailParseStack(this);
                                return value;
                            }
                        }, configurable: true, enumerable: true});
                    })(proto, proto.toString, util.getOwnPropertyDescriptor(proto, 'stack'));
                    errorsSanitized = true;
                    return true;
                }
            };
            var snippets = data.snippets;
            var valueToMessage = imports.valueToMessage;

            var postDesc = Object.getOwnPropertyDescriptor(self, "postMessage");
            if (postDesc == null || postDesc.configurable) {
                (post => { //make sure we don't override the worker postmessage (local var)
                    function sendMessageToMain(message) {
                        post("Message(" + imports.valueToMessage(message) + ")");
                    }
                    //We Do this so that the code of sendMessageToMain is not exposed by toString
                    function postMessage(message) {
                        sendMessageToMain(message);
                    }
                    var st = postMessage.toString.toString();
                    var str = st.split("toString").join("postMessage");
                    postMessage.toString = () => str;
                    postMessage.toString.toString = () => st;
                    Object.defineProperty(self, "postMessage", { value: postMessage, configurable: true, writable: true, enumerable: false });
                })(postMessage);
            }

            addEventListener('message', function (e) {
                /**
                 * There are two types of messages:
                 * 1. Communication manage message: the code in these messages are
                 *    trusted from the main program. These code has access to 'data' and 'root'
                 * 2. Eval messages: The code in these message are not trusted
                 *                   and are only executed in the global space.
                 */
                if (typeof e.data == 'string' || e.data instanceof StringType) {
                    var code = util.trim(String(e.data));
                    if (util.startsWith(code, ">")) {
                        var ret = apply(new Function(code.substring(1)), [data, true]);
                        data.functionReturns[ret[0]].resolve(ret[1]);
                        delete data.functionReturns[ret[0]];
                        return;
                    }
                    if (util.startsWith(code, "<")) {
                        var ret = apply(new Function(code.substring(1)), [data, false]);
                        data.functionReturns[ret[0]].reject(ret[1]);
                        delete data.functionReturns[ret[0]];
                        return;
                    }
                    try {
                        if (util.startsWith(code, "\"")) {
                            var search = util.indexOf(code, "\";");
                            if (search < 0) return;
                            var name = JSON.parse(util.substring(code, 0, search + 1));
                            if (name == undefined) return;
                            if (!(name in snippets)) return;
                            var snippet = snippets[name];
                            code = util.substring(code, search + 2);
                            apply(snippet, [data, code]);
                        } else {
                            try {
                                postMessage('Return(' + valueToMessage(apply(new Function(e.data), [data])) + ')');
                            } catch (ex) {
                                postMessage('ReturnError(' + valueToMessage(ex) + ')');
                            }
                        }
                    } catch (ex) {
                        postMessage('Error(' + valueToMessage(ex) + ')');
                    }
                } else {
                    if (typeof e.data == 'object' && e.data.index && e.data.value) {
                        data.objs[e.data.index] = e.data.value;
                    } else {
                        util.push(data.postedObj, e.data);
                    }
                }
            });
            var exeCode = (() => function RunJailedCode(func) {
                return apply(func, [self]);
            })();
            util.defineProperty(exeCode, "name", {configurable: false, writable: false, value: 'RunJailedCode' + jailID});
            var exeCompiled = (() => function RunJailedCode() {
                return apply(this, [self]);
            })();
            util.defineProperty(exeCompiled, "name", {configurable: false, writable: false, value: 'RunJailedCode' + jailID});

            snippets.compile = function(code) {
                try {
                    postMessage("Return(" + valueToMessage(bind(exeCompiled, parser(code))) + ")");
                } catch(ex) {
                    postMessage("ReturnError(" + valueToMessage(ex) + ")");
                }
            };
            snippets.compile_async = function(code) {
                try {
                    postMessage("Return(" + valueToMessage(bind(exeCompiled, parserAsync(code))) + ")");
                } catch(ex) {
                    postMessage("ReturnError(" + valueToMessage(ex) + ")");
                }
            };
            snippets.compile_generator = function(code) {
                try {
                    postMessage("Return(" + valueToMessage(bind(exeCompiled, parserGenerator(code))) + ")");
                } catch(ex) {
                    postMessage("ReturnError(" + valueToMessage(ex) + ")");
                }
            };
            snippets.eval = function (code) {
                try {
                    postMessage('Return(' + valueToMessage(global_eval(code)) + ')');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(ex) + ')');
                }
            };
            snippets.eval_static = function (code) {
                try {
                    postMessage('Return(' + valueToMessage(data.static(global_eval(code))) + ')');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(data.static(ex)) + ')');
                }
            };
            snippets.function = function (code) {
                try {
                    postMessage('Return(' + valueToMessage(exeCode(parser(code))) + ')');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(ex) + ')');
                }
            };
            snippets.async_function = function (code) {
                try {
                    postMessage('Return(' + valueToMessage(exeCode(parserAsync(code))) + ')');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(ex) + ')');
                }
            };
            snippets.generator_function = function (code) {
                try {
                    postMessage('Return(' + valueToMessage(exeCode(parserGenerator(code))) + ')');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(ex) + ')');
                }
            };
            var _apply = Function.prototype.apply; //_apply for call
            snippets.call = function (code) {
                try {
                    var r = apply(new Function(code), [data]);
                    if (!("bind" in r)) {
                        r.bind = self;
                    }
                    postMessage('Return(' + valueToMessage(apply(function () {
                        return bind(_apply, r.function)(this, r.args);
                    }, [r.bind])) + ')');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(ex) + ')');
                }
            }
            snippets.callvoid = function (code) {
                try {
                    var r = apply(new Function(code), [data]);
                    if (!("bind" in r)) {
                        r.bind = self;
                    }
                    apply(function () {
                        return bind(_apply, r.function)(this, r.args);
                    }, [r.bind]);
                    postMessage('Return(undefined)');
                } catch (ex) {
                    postMessage('ReturnError(' + valueToMessage(ex) + ')');
                }
            }
        })();
    })(
        /**
         * By declaring the eval function here (and giving it as argument to the closure), we absolutely know
         * that the eval function has no access to any variables in the closure.
         */
        (() => {
            arguments = null;

            //we create this function (with a name) so that you can identify (from the stack of errors)
            //between the jailed core and the jailed code
            //this declaration is in a closure so that there is no global value 'RunJailedCode'
            return (function RunJailedCode(_globalEval_, _myCode_) {
                arguments = null;
                return (1, _globalEval_)(_myCode_);
            }).bind(self, self.eval.bind(self));
        })()
    );
});
this.jailFunc("");