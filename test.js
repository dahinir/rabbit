import test from 'ava';

const Machine = require('./machine.js').Machine;
const Machines = require('./machine.js').Machines;


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

/*
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
