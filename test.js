"use strict"

const Machine = require('./machine.js').Machine;
const Machines = require('./machine.js').Machines;


const arr = ["hi", "hey", "hello"]
arr[Symbol.iterator] = function () {
    let i = 0
    let arr = this
    return {
        next: function () {
            if (i >= arr.length) {
                return {
                    done: true
                }
            } else {
                return {
                    value: arr[i++] + "..",
                    done: false
                }
            }
        }
    }
}
for (const e of arr)
    console.log(e)

// arr.forEach()

const obj = {
    horse: "hoho",
    unicorn: "uniu"
}
for (const e in obj) {
    console.log(e)
}

/*
const foo = {name: "foo", age: 2}
const bar = {name: "bar", age: 3}

// console.log({foo, bar})
const fb = {foo, bar}
// console.log(fb.foo)
// console.table([foo, bar])

console.time('too')
let i = 0
while(i < 1000000){ i++ }
const ha = () => console.trace("byby")
ha()
console.timeEnd('too') 

// console.log('%c hey', 'color: orange;')


test("machines.mind", async t => {

    const machines = new Machines();
    machines.fetchAll({
    	success: () => {
        // Now machines are loaded from db
        const result = await new Promise(resolve => {
          machines.mind({
            success: result => {
              resolve(result);
            }
          })
        });
    	}
    });

    t.deepEqual(result.total, machines.length);
})


test("dd",t => {
    t.deepEqual([1, 2], [1, 2]);
});

test('foo', t => {
    t.pass();
});

test('bar', async t => {
    const bar = Promise.resolve('bar');

    t.is(await bar, 'bar');
});
*/