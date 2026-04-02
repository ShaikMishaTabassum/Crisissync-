// backend/ai/forecaster.js
const DAILY_CONSUMPTION = {
  ors_packets:    2,
  water_litres:   10,
  food_kg:        0.5,
  medicine_units: 0.3,
};

const CRITICAL_HOURS = 24;
const WARNING_HOURS  = 48;

function forecastCamp(camp) {
  const alerts     = [];
  const population = camp.population || 0;
  if (population === 0) return alerts;

  for (const [item, ratePerDay] of Object.entries(DAILY_CONSUMPTION)) {
    const currentStock   = (camp.supplies         || {})[item] || 0;
    const incoming       = (camp.incomingSupplies || {})[item] || 0;
    const effectiveStock = currentStock + incoming;
    const dailyNeed      = population * ratePerDay;
    const hoursRemaining = (effectiveStock / dailyNeed) * 24;

    if (hoursRemaining <= CRITICAL_HOURS) {
      alerts.push({
        campId: camp.id, campName: camp.name, item,
        currentStock, incoming, population,
        hoursRemaining: Math.round(hoursRemaining),
        severity: 'critical',
        message: `CRITICAL: ${camp.name} will run out of ${item} in ${Math.round(hoursRemaining)}h`
      });
    } else if (hoursRemaining <= WARNING_HOURS) {
      alerts.push({
        campId: camp.id, campName: camp.name, item,
        currentStock, incoming, population,
        hoursRemaining: Math.round(hoursRemaining),
        severity: 'warning',
        message: `WARNING: ${camp.name} may run short of ${item} in ${Math.round(hoursRemaining)}h`
      });
    }
  }
  return alerts;
}

function forecastAll(camps) {
  return camps
    .flatMap(c => forecastCamp(c))
    .sort((a, b) => a.hoursRemaining - b.hoursRemaining);
}

module.exports = { forecastCamp, forecastAll };