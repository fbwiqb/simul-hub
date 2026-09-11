const assert = require('node:assert/strict');
const physics = require('./particle-physics.js');

const h1 = { id: 'h1', x: 0, y: 0 };
const h2 = { id: 'h2', x: 100, y: 0 };
const oh1 = { id: 'oh1', x: 90, y: 0 };
const oh2 = { id: 'oh2', x: 10, y: 0 };
const pairs = physics.pairOppositeIons([h1, h2], [oh1, oh2]);

assert.deepEqual(
    pairs.map(pair => [pair.h.id, pair.oh.id]),
    [['h1', 'oh2'], ['h2', 'oh1']],
    'each H+ and OH- must form one mutual nearest pair'
);
assert.equal(new Set(pairs.map(pair => pair.h)).size, pairs.length);
assert.equal(new Set(pairs.map(pair => pair.oh)).size, pairs.length);
assert.equal(physics.areIonsTouching({ x: 0, y: 0 }, { x: 40, y: 0 }), true);
assert.equal(physics.areIonsTouching({ x: 0, y: 0 }, { x: 40.01, y: 0 }), false);

console.log('particle physics regression checks passed');
