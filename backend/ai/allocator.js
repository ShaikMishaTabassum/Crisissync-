// backend/ai/allocator.js
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2) * Math.sin(dLat/2)
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function severityScore(priority) {
  return { sos: 1.0, high: 0.75, normal: 0.5, low: 0.25 }[priority] || 0.5;
}

function hasRequiredSkills(volunteer, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) return true;
  return requiredSkills.every(skill => (volunteer.skills || []).includes(skill));
}

function isInRedZone(volunteer, zones) {
  return Object.values(zones).some(
    z => z.gridId === volunteer.gridId && z.safetyLevel === 'red'
  );
}

function findBestVolunteer(task, volunteers, zones) {
  const available = Object.values(volunteers).filter(v =>
    v.status !== 'busy'
    && hasRequiredSkills(v, task.requiredSkills)
    && !isInRedZone(v, zones)
  );

  if (available.length === 0) {
    console.log('⚠️  No available volunteers match this task.');
    return null;
  }

  const scored = available.map(v => {
    const dist = (v.lat && task.lat)
      ? haversineDistance(v.lat, v.lng, task.lat, task.lng)
      : 10;

    const proximityScore = Math.max(0, 1 - dist / 20);

    const waitMins  = v.lastTaskAt
      ? (Date.now() - new Date(v.lastTaskAt).getTime()) / 60000
      : 60;
    const waitScore = Math.min(1, waitMins / 120);

    const score = severityScore(task.priority) * 0.5
                + waitScore                     * 0.3
                + proximityScore                * 0.2;

    return { volunteer: v, score, distKm: dist.toFixed(1) };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  console.log(`🎯 Best match: ${best.volunteer.name} (score=${best.score.toFixed(2)}, dist=${best.distKm}km)`);
  return best.volunteer;
}

module.exports = { findBestVolunteer, haversineDistance };