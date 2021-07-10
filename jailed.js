/*# sourceMappingURL=Jailed Core */
/**
 * The code for the communication between the jail and the main program. (on the jail side)
 * will work in a closure. Why? Every important local value and function in this closure will not be accessible
 * outside this closure for the jailed code.
 */
(function (global_eval) {
    var undefined = undefined;
    /**
     * The untrusted code may alter any important native function and value that are provided from the VM,
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
    var jailed_to_string = function () { return "function () { [jail API] }" };

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
        var _getLength = Object.getOwnPropertyDescriptor(Array.prototype, 'length');
        if (_getLength) _getLength = _getLength.get;
        var _getDescription = Object.getOwnPropertyDescriptor(Symbol.prototype, 'description');
        if (_getDescription) _getDescription = _getDescription.get;
        var _getArray = Array.prototype.slice;
        var _trim = String.prototype.trim;
        var _String = String;
        var _s_toString = String.prototype.toString;
        var _n_toString = Number.prototype.toString;
        var _b_toString = Boolean.prototype.toString;
        var _push = Array.prototype.push;
        var _pop = Array.prototype.pop;
        var _concat = Array.prototype.concat;
        var _f_to_string = Function.prototype.toString;
        var _f_to_string_string = Function.prototype.toString.toString;
        var _f_str = Function.prototype.toString.toString();
        var _promise_then = Promise.prototype.then;
        var _boolean_value_of = Boolean.prototype.valueOf;
        var _bigint_value_of = BigInt.prototype.valueOf;
        var _bigint_to_string = BigInt.prototype.toString;
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

        var _array_get_iterator = Array.prototype[Symbol.iterator];
        var _array_next = Object.getPrototypeOf([][Symbol.iterator]()).next;
        Function.prototype.toString = function () {
            if (this.toString === jailed_to_string) return apply(jailed_to_string, [this]);
            else if (this === _f_to_string || this === _f_to_string_string) return _f_str;
            else if (this === jailed_to_string) return _f_str;
            else return apply(_f_to_string, [this]);
        };
        Function.prototype.toString.toString = function () { return _f_str };
        Function.prototype.toString.toString[Symbol.toStringTag] = _f_str;
        root = {
            String: function (str) {
                if (str instanceof _String) {
                    return apply(_s_toString, [str]);
                } else if (str instanceof root.Number) {
                    return apply(_n_toString, [str]);
                } else if (str instanceof root.Boolean) {
                    return apply(_b_toString, [str]);
                } else if (str instanceof root.BigInt) {
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
            TypeError,
            Set,
            Map,
            Date,
            BigInt,
            Event: self.Event ? self.Event : null,
            ErrorEvent: self.ErrorEvent ? self.ErrorEvent : null,
            PromiseRejectionEvent: self.PromiseRejectionEvent ? self.PromiseRejectionEvent : null,
            EventTarget: self.EventTarget ? self.EventTarget : null,
            toStringTag: Symbol.toStringTag,
            errors: { EvalError, RangeError, ReferenceError, SyntaxError, TypeError, AggregateError: self.AggregateError, InternalError: self.InternalError },
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
                indexOf(str, search) {
                    return apply(_indexOf, [str, search]);
                },
                startsWith(str, search) {
                    return apply(_startsWith, [str, search]);
                },
                arrayLength(arr) {
                    if (_getLength == undefined) {
                        return arr.length; //the .length is not configurable
                    } else {
                        return apply(_getLength, [arr]);
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
                pop(arr, val) {
                    return apply(_pop, [arr, val]);
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
                isNaN,
                apply,
                bind
            },
        }
        var addEventListener = self.addEventListener;
        var undefined = root.undefined;
        /**
         * The webworker can do more then the jailed code is privileged to do.
         * The jailed code can only execute functions from VM that only has impact on their own stuff. (like substring)
         * 
         * You can allow more by copying the values from apis.
         */
        //Temporary and persistent are constants that cannot be redefined
        var whitelist = ["Object", "Function", "Array", "Number", "parseFloat", "parseInt", "Infinity", "NaN", "undefined", "Boolean", "String", "Symbol", "Date", "Promise", "RegExp", "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "JSON", "Math", "Intl", "ArrayBuffer", "Uint8Array", "Int8Array", "Uint16Array", "Int16Array", "Uint32Array", "Int32Array", "Float32Array", "Float64Array", "Uint8ClampedArray", "BigUint64Array", "BigInt64Array", "DataView", "Map", "BigInt", "Set", "WeakMap", "WeakSet", "Proxy", "Reflect", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", "unescape", "eval", "isFinite", "isNaN", "SharedArrayBuffer", "Atomics", "globalThis", "self", "WebAssembly", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "EventTarget", "Event", "ErrorEvent", "PromiseRejectionEvent", "onerror", "onrejectionhandled", "onunhandledrejection", "TEMPORARY", "PERSISTENT"];
        var blacklist = ["onmessage", "onmessageerror", "postMessage"];
        var root_keys = Object.getOwnPropertyNames(self).concat(Object.getOwnPropertySymbols(self) || []);
        var root_length = root_keys.length;
        var EventTarget = self.EventTarget;
        var EventTargetProto = null;
        if (EventTarget) {
            EventTargetProto = EventTarget.prototype;
            rootEventTarget = new EventTarget();
        }
        apis.addEventListener = (...args) => {
            if (args.length < 2) return;
            if (String(args[0]) == "message") return;
            return addEventListener(...args);
        };
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
                    try { if (!apis[key]) apis[key] = proto[key]; } catch (ex) { }
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
                                add(name, dispatch);
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
            if(messagedesc == null || messagedesc.configurable) {
                var list = null;
                Object.defineProperty(self, "onmessage", {get: () => list, set: val => list = val, enumerable: false, configurable: true});
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



    var addMessageListener;
    var data;
    var imports = {
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
            var util = root.util;
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
            } else if(typeof value == 'bigint') {
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
            } else if (value instanceof BigInt) {
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
                    return "Error(" + JSON.stringify(typeName) + "," + JSON.stringify(String(value.name)) + "," + JSON.stringify(String(value.message)) + "," + JSON.stringify(String(value.stack)) + "," + String(index) + ")";
                }
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
                var callFunctionInMain = function (a) {
                    var str = 'Call(' + index + ',' + valueToMessage(this);
                    var args = util.toArray(a);
                    for (var i = 0; i < util.arrayLength(args); i++) {
                        str += ',' + valueToMessage(args[i]);
                    }
                    str += ')';
                    root.postMessage(str);
                    return new Promise(function (resolve, reject) {
                        addMessageListener(function (r, s) {
                            if (s) resolve(r);
                            else reject(r);
                        });
                    });
                };
                //we do this so that the code from (callFunctionInMain) is not exposed by toString
                var r = function JailedFunction() {
                    return callFunctionInMain(arguments);
                }
                util.defineProperty(r, 'toString', {
                    configurable: false,
                    enumerable: false,
                    writable: false,
                    value: jailed_to_string
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
        var AsyncFunction = root.AsyncFunction;
        var GeneratorFunction = root.GeneratorFunction;
        var Symbol = root.Symbol;
        var JSON = { parse: root.JSON.parse, stringify: root.JSON.stringify };
        var Array = root.Array;
        var Event = root.Event;
        var util = root.util;
        var bind = root.bind;
        var apply = root.apply;
        var undefined = root.undefined;
        var self = root.self;

        /* Local imports */
        var stack = [];

        /* Root for the code from the messages */
        data = {
            self: self,
            objs: { 0: self, 1: apis, 2: apiEvents },
            global: self,
            count: 3,
            snippets: {},
            postMessage: postMessage,
            wrap: imports.messageToValue,
            root,
            util,
            global_eval,
            apis,
            apiEvents,
            registerRootListener,
            rootEventTarget,
            symbol: function (x, y) {
                if (x in data.objs) return data.objs[x];
                else {
                    var s;
                    if (y == undefined) s = Symbol();
                    else s = Symbol(y);
                    data.objs[x] = s;
                    return s;
                }
            },
            static: function (x, y) {
                if (y == undefined) y = true;
                if (typeof x == 'object' || typeof x == 'function') {
                    return new StaticType(x, y);
                } else {
                    return x;
                }
            },
            whitelist: function (x) {
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
            whitelistEvent: function (x) {
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
            postMessage: function(message) {
                var ev = new Event('message');
                ev.data = message;
                return util.dispatchEvent(rootEventTarget, ev);
            }
        };
        var snippets = data.snippets;
        var valueToMessage = imports.valueToMessage;
        addMessageListener = function (f) {
            util.push(stack, f);
        };

        var postDesc = Object.getOwnPropertyDescriptor(self, "postMessage");
        if(postDesc == null || postDesc.configurable) {
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
                Object.defineProperty(self, "postMessage", {value: postMessage, configurable: true, writable: true, enumerable: false});
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
                var stackLength = util.arrayLength(stack);
                if (stackLength > 0 && util.startsWith(code, ">")) {
                    util.pop(stack)(apply(new Function(code.substring(1)), [data, true]), true);
                    return;
                }
                if (stackLength > 0 && util.startsWith(code, "<")) {
                    util.pop(stack)(apply(new Function(code.substring(1)), [data, false]), false);
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
                if (stackLength > 0) {
                    util.pop(stack)(e.data);
                    return;
                }
                data.objs[data.count++] = e.data;
            }
        });

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
                postMessage('Return(' + valueToMessage(apply(new Function(code), [self])) + ')');
            } catch (ex) {
                postMessage('ReturnError(' + valueToMessage(ex) + ')');
            }
        };
        snippets.async_function = function (code) {
            try {
                postMessage('Return(' + valueToMessage(apply(new AsyncFunction(code), [self])) + ')');
            } catch (ex) {
                postMessage('ReturnError(' + valueToMessage(ex) + ')');
            }
        };
        snippets.generator_function = function (code) {
            try {
                postMessage('Return(' + valueToMessage(apply(new GeneratorFunction(code), [self])) + ')');
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
    })();
})(
    /**
     * By declaring the eval function here (and giving it as argument to the closure), we absolutely know
     * that the eval function has no access to any variables in the closure.
     */
    (function (_globalEval_, _myCode_) {
        arguments = undefined;
        return (1, _globalEval_)(_myCode_);
    }).bind(self, self.eval.bind(self))
);
