(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.NeutralizationPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function distanceSquared(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return dx * dx + dy * dy;
    }

    function pairOppositeIons(hIons, ohIons, maxDistanceSquared = Infinity) {
        const candidates = [];
        hIons.forEach(h => {
            ohIons.forEach(oh => {
                const distanceSq = distanceSquared(h, oh);
                if (distanceSq <= maxDistanceSquared) candidates.push({ h, oh, distanceSq });
            });
        });
        candidates.sort((a, b) => a.distanceSq - b.distanceSq);

        const usedH = new Set();
        const usedOH = new Set();
        const pairs = [];
        candidates.forEach(candidate => {
            if (usedH.has(candidate.h) || usedOH.has(candidate.oh)) return;
            usedH.add(candidate.h);
            usedOH.add(candidate.oh);
            pairs.push(candidate);
        });
        return pairs;
    }

    function areIonsTouching(a, b, diameter = 40) {
        return distanceSquared(a, b) <= diameter * diameter;
    }

    return { distanceSquared, pairOppositeIons, areIonsTouching };
});
