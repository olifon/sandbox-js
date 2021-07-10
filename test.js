/**
 * This code tests the jail for any bugs.
 */
(async function () {
    /**
     * This test utility is used in this test,
     * you pass a condition to the 'assert' functionm
     * if the result is false, assert will throw an error that the test failed.
     * @param {boolean} eq the condition 
     */
    var assert = function (eq) {
        if (typeof eq != 'boolean') throw new Error('Assert failed, not a boolean supplied.');
        if (!eq) throw new Error('Assert failed.');
    }
    //this function checks of the contents of a object equals (not their references.)
    var isEquivalent = async function (a, b) {
        var aProps = Object.getOwnPropertyNames(a);
        var bProps = Object.getOwnPropertyNames(b);

        if (aProps.length != bProps.length) return false;

        for (var i = 0; i < aProps.length; i++) {
            var propName = aProps[i];
            var aValue = a[propName];
            var bValue = b[propName];
            if (typeof aValue != typeof bValue) return false;
            else if (aValue instanceof String || aValue instanceof Number || aValue instanceof Boolean || aValue instanceof Symbol) if (!aValue.valueOf() == bValue.valueOf())
                return false;
            else if (aValue instanceof JailObject) if (!aValue === bValue)
                return false;
            else if (aValue instanceof Promise || aValue instanceof JailPromise) {
                if (aValue instanceof JailPromise && bValue instanceof JailPromise) if (!aValue === bValue)
                    return false;
                if (aValue instanceof JailPromise) aValue = aValue.value;
                if (bValue instanceof JailPromise) bValue = bValue.value;
                if (!aValue === bValue) return false;
            }
            else if (typeof aValue == 'object') {
                if (aValue == null || bValue == null) if (!aValue === bValue)
                    return false;
                if (!(await (isEquivalent(aValue, bValue))))
                    return false;
            }
            //typeof of a function returns 'function', functions do not always need to equal.
            //because functions returned from jail, must ALWAYS return promises. So for the jail that
            //returns main JS functions, a wrapper around the main JS function is created to make 
            //sure it returns a Promise.
            else if (typeof aValue == 'function') {
                //Test our functions
                //bValues are the functions from jail.
                var message = 'test function ' + String(i) + ' ' + String(Math.random());
                if (!aValue(message) == await (bValue(message)))
                    return false;
            }
            else if (typeof aValue == 'number' && isNaN(aValue) && isNaN(bValue))
                continue;
            else if (aValue !== bValue)
                return false;
        }

        return true;
    }

    //Setup jail
    assert(true);
    var jail = new JailJS();
    assert(jail != null);
    var root = jail.root;
    assert(root != null);
    var ping = new Promise(function (resolve, reject) {
        jail.ping().then(function (r) {
            ping.done = true;
            resolve(r);
        }, function (ex) {
            reject(ex);
        });
    });
    ping.done = false;

    /* Lets test some values */
    assert(!jail.is_terminated); //check for is_terminated
    assert(root.jail == jail);
    assert(root.isRoot());
    assert(await jail.execute('"hello world"') == "hello world");
    assert(ping.done); //we waited for an other action, ping NEEDS to be fullfilled.
    assert(await jail.execute('undefined') === undefined);
    assert(await jail.execute('null') === null);
    assert(await jail.execute('12345') == 12345);
    assert(root == await root.get('self'));

    /* Lets test simple objects */
    jail.execute('var obj1 = {};'); //tasks are queued, so we don't need to always use await.
    jail.execute('var obj2 = {};');
    var obj1 = await root.get('obj1');
    assert(!obj1.isRoot());
    assert(!obj1.isFunction());
    assert(obj1 != await root.get('obj2')); //different objects don't equals
    assert(obj1 != await jail.execute('({})')); //new objects also don't equal
    assert(obj1 == await jail.execute('obj1')); //same object does


    /* A new ES6 feature, Symbols. Lets test that. */
    var sym3 = Symbol('hello world');
    root.set('sym1', sym3); //symbols supplied from the main JS.
    jail.execute('var sym2 = Symbol("hello world");');
    var sym1 = await root.get('sym1');
    var sym2 = await root.get('sym2');
    assert(sym1 == sym3); //symbol from main JS must equal to symbol from jail.
    assert(sym1 == await root.get('sym1'));
    assert(sym2 == await root.get('sym2'));
    assert(sym1 != sym2); //other symbols (even with the same description) may not equal.
    assert(typeof sym1 == 'symbol');
    assert(typeof sym2 == 'symbol');
    assert(sym1 != Symbol('hello world')); //new created symbols may never compare
    assert((await jail.execute('Symbol("other description")')).description == "other description"); //description needs to equal.

    /**
     * Tests primitive types wrapped in Objects and some other execute functions.
     */
    var str = await jail.executeAsFunction('var x = new String("hello world"); x.test = "test123"; return x;');
    assert(await str.instanceOf(await root.get('String')));
    assert(str.valueOf() == 'hello world');
    assert(await str.get('test') == 'test123');
    var sym4 = await jail.objectOf(sym1);
    assert(await sym4.instanceOf(await root.get('Symbol')));
    assert(sym4.valueOf() == sym1);
    //Test symbols and Promises
    var symbol = await jail.executeAsAsyncFunction('return Symbol("jail");');
    assert(symbol instanceof JailObject);
    assert(await symbol.instanceOf(await root.get('Promise')));
    symbol = symbol.valueOf();
    assert(symbol instanceof JailPromise);
    symbol = await symbol.value;
    assert(typeof symbol == 'symbol');
    assert(symbol.description == 'jail');

    /* Test errors */
    try {
        await jail.execute('throw new TypeError("test error");')
    } catch (ex) {
        assert(ex instanceof JailError);
        assert(ex.name == 'TypeError');
        assert(ex.message.includes("test error"));
    }

    /**
     * Tests some utility
     */
    obj1.set('x', 'y');
    assert(await obj1.get('x') == 'y');
    assert(!(await obj1.isFrozen()))
    assert(!(await obj1.isSealed()))
    assert(await obj1.isExtensible());
    obj1.defineProperty('a', { enumerable: true, configurable: false, writable: false, value: 'b' });
    assert(await obj1.get('a') == 'b');
    obj1.set('x', '_y');
    assert(await obj1.set('a', 'd') == 'd');
    assert(await obj1.get('x') == '_y');
    assert(await obj1.get('a') == 'b');
    assert(!(await obj1.isFrozen()))
    assert(!(await obj1.isSealed()))
    assert(await obj1.isExtensible());
    var to_add1 = Symbol('to_add');
    var to_add2 = Symbol('to_add');
    obj1.set('new', to_add1);
    assert(await obj1.get('new') == to_add1);
    obj1.defineProperty('new', { enumerable: false, configurable: true, writable: true, value: to_add2 });
    assert(await obj1.has('x'));
    assert(await obj1.has('a'));
    assert(await obj1.has('new'));
    assert(!(await obj1.has('not_me')));
    assert(await isEquivalent(await obj1.keys(), ['x', 'a']));
    assert(await isEquivalent(await obj1.getOwnPropertyNames(), ['x', 'a', 'new']));
    obj1.set('delete_me', 'ok');
    assert(await obj1.get('delete_me') == 'ok');
    assert(await obj1.delete('delete_me'));
    assert(!(await obj1.has('delete_me')));
    assert(!(await obj1.delete('a')));
    var obj2 = await root.get('obj2');
    obj1.set('z', obj2);
    obj1.preventExtensions();
    assert(!(await obj1.isFrozen()))
    assert(!(await obj1.isSealed()))
    assert(!(await obj1.isExtensible()));
    obj1.set('possible', true);
    assert(await obj1.get('possible') == undefined);
    assert(!(await obj1.has('possible')));
    assert(await obj1.get('z') == obj2);
    obj1.set('z', {});
    assert(await obj1.has('z'));
    assert(await obj1.get('z') != obj2);
    assert(await obj1.delete('z'));
    assert(await obj1.get('z') == undefined);
    assert(!(await obj1.has('z')));
    obj1.seal();
    assert(!(await obj1.isFrozen()));
    assert(await obj1.isSealed());
    assert(!(await obj1.isExtensible()));
    obj1.set('possible', true);
    assert(await obj1.get('possible') == undefined);
    assert(!(await obj1.has('possible')));
    assert((await obj1.set('x', 8)) == 8);
    assert(await obj1.get('x') == 8);
    var didCatch = false;
    try {
        await obj1.defineProperty('x', { configurable: true, value: 3 });
    } catch (ex) {
        assert(ex instanceof JailError);
        assert(ex.name == 'TypeError');
        didCatch = true;
    }
    assert(didCatch);
    assert(!(await obj1.delete('x')));
    assert(await obj1.has('x'));
    obj1.freeze();
    assert(await obj1.isFrozen());
    assert(await obj1.isSealed());
    assert(!(await obj1.isExtensible()));
    obj1.set('possible', true);
    assert(await obj1.get('possible') == undefined);
    assert(!(await obj1.has('possible')));
    assert((await obj1.set('x', 10)) == 10);
    assert(await obj1.get('x') == 8);

    /*
    * Test the functions.
    * 
    * Functions from Jail:
    * * They always returns promises resulting in the values
    * * If the function returned a promise, a JailPromise is returned.
    * * the .toString() don't give useful information. They give the code for the created wrapper function on the main JS side.
    * 
    * Functions from main:
    * * They also returns promises resulting in the values.
    * * One exception, if they returned a promise, a new Promise is returned that resolves the resolved value from the returned one.
    * * the .toString() gives 'function () { [jail API] }'
    */
    sym4.set('test', 'symbol');
    assert(await sym4.get('test') == 'symbol');
    var returnMe = await jail.execute("(function(ret) {return ret;})");
    assert(returnMe.isFunction());
    var symret = await returnMe.invoke([sym1]);
    assert(symret == sym1);
    var promise1 = await jail.execute("Promise.resolve('hello world');");
    var promise2 = await jail.execute("Promise.reject(new Error('ignore me as uncaught.'));");
    assert(await promise1.instanceOf(await jail.execute("Promise;")));
    assert(await promise2.instanceOf(await jail.execute("Promise;")));
    assert(await promise1.valueOf().value == 'hello world');
    var promiseResult;
    try {
        await promise2.valueOf().value;
    } catch (ex) {
        promiseResult = ex;
    }
    if (promiseResult == undefined) assert(false);
    assert(promiseResult instanceof JailError);
    assert(promiseResult.message.includes('ignore me as uncaught.'));
    assert((await returnMe.invoke([promise1])).valueOf().value == promise1.valueOf().value);
    var message = { test: 'Hello World Jail.' };
    var funcResult;
    var messageReturn = (await new Promise(function (resolve, reject) {
        (async function () {
            funcResult = await (await (await jail.execute('(function(x, y) {return x(y);})'))).invoke([
                async function (y) { //we call this function 'x'
                    resolve(await (y.resolve(true))); //test resolve
                    return "ok";
                },
                message
            ]);
        })();
    }));
    //because message was cloned to jail, it doesn't equal to messageReturn.
    //therefore we only need to check if the contents equals.
    assert(message != messageReturn);
    assert(await isEquivalent(message, messageReturn));
    /*
        We invoked jail function (z) with a function from main (x).
        function z invokes x and returns the result. because functions from main always returns promises, 
        this one also returns a promise. That promise is passed to the main program as a JailPromise.
    */
    assert(funcResult.valueOf() instanceof JailPromise);
    assert(await funcResult.valueOf().value == 'ok');
    //test timeoutAfter (an extension to ping(), when the timeout is passed an error is thrown and the jail terminates)
    await jail.timeoutAfter(1000);
    /* Test complex objects passing to functions. */
    var returnArgs = await jail.execute('(function() {return Array.prototype.slice.call(arguments);})');
    var input = [
        true,
        false,
        null,
        undefined,
        NaN,
        root,
        'hey',
        'Hello world',
        Symbol('hello'),
        Symbol('world'),
        [
            'lol',
            {
                test: "object reference test",
                other: { foo: 'bar' }
            },
            Symbol('new'),
            function (test) { return "lol " + test; },
            new Boolean(true)
        ],
        { a: 'b' },
        function (test) { return 'other test ' + test },
        new String("Alex"),
        new Number(8E3),
        new Number(8823),
        new Boolean(false),
        Object(Symbol('f')),
        Promise.resolve('resolved promise'),
        Promise.reject('rejected promise'),
        new JailPromise(Promise.resolve('resolved jail promise')),
        new JailPromise(Promise.reject('rejected jail promise')),
        12356,
        1.56,
        NaN,
        Infinity,
        -Infinity
    ];
    var result = await returnArgs.invoke(input);
    assert(await result.instanceOf(await jail.execute('Array;')));
    result = await result.resolve(true);


    //objects recieved from resolve do NOT reference equal to the input objects. This is because the input objects were cloned to the jail.
    //but Symbols and functions do equal.
    assert(await isEquivalent(input, result));

    /**
     * Finally, check if it is possible to cause a Denial of Service attack.
     * Or worse: check if it possible to break out of the jail.
     */



    //set some important VM functions for the jail to null, the jail still needs to work.
    jail.execute('Function.prototype.call = null; Function.prototype.bind = null; Object.keys = null; '
        + 'Object.getOwnPropertyNames = null; String.prototype.trim = null; String.prototype.substring = null;'
        + 'String.prototype.indexOf = null; String.prototype.startsWith = null; Function.prototype.apply = null;'
        + 'Promise.prototype.then = null; Promise.prototype.reject = null;');

    //test it :-)
    var test_values = async function () {
        assert(await jail.execute('"hello world"') == "hello world");
        assert(await jail.execute('undefined') === undefined);
        assert(await jail.execute('null') === null);
        assert(await jail.execute('123.4') == 123.4);
        assert(root == await root.get('self'));
        assert(await returnMe.invoke(['hello']) == 'hello');
        assert(await returnMe.invoke([sym1]) == sym1);
        assert(await (await returnMe.invoke([promise1])).valueOf().value == 'hello world');
    }
    await test_values();

    //Now set some import classes to null.
    jail.execute("String = null; Object = null; Function = null; Symbol = null; Promise = null;")
    await test_values();

    var rejected = 0;
    /* Check Denial of Service attack */
    var neverReturn = jail.execute('while(1) {}'); //this never returns
    /* the jail is now executing a infinite loop, this means that every other task never finish :-/
       but we can still terminate the jail.
    */
    try {
        await jail.terminate(250); //terminate after 250 ms, because of timeout.
    } catch (ex) {
        rejected++;
        assert(ex instanceof JailTerminatedError);
        /*
            because of termination, the neverReturn promise from the 'execute' will reject.
            To prevent errors of uncaught promises, we set an empty caught.
        */
        try {
            await neverReturn;
        } catch (ex2) {
            rejected++;
            assert(ex == ex2);
        }
    }
    /**
     * To test for the returned promises, 2 times a promise needs to be rejected.
     * first from jail.terminate that the terminated has been forced.
     * And second from the neverReturn. If you terminate the execution all other
     * pending tasks will reject (also new tasks will auto reject because the jail is terminated).
     */
    assert(rejected == 2);
    assert(jail.is_terminated); //check for is_terminated
})();