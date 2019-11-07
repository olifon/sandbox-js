

var strProxy = function(str) {
    var prox;
    var isNative = function(f) {
        return /\{\s+\[native code\]/.test( Function.prototype.toString.call(f));  
    }
    var nativeAlternative = function(func) {
        return function() {
            if(this != prox) return func.apply(this, Array.prototype.slice.call(arguments));
            else return func.apply(str, Array.prototype.slice.call(arguments));
        };
    }
    if(!(str instanceof String)) str = new String(str);
    prox = new Proxy(str, {
        get(target, name) {
            var value = str[name];
            if(!(typeof value == 'function')) return value;
            if(!isNative(value)) return value;
            return nativeAlternative(value);
        }
    });
    return prox;
}