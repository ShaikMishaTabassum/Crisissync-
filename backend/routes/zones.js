// backend/routes/zones.js
const express = require('express');
const router  = express.Router();

router.get('/', (req, res) => {
  res.json(req.app.locals.state.zones);
});

router.post('/', (req, res) => {
  const { gridId, lat, lng, safetyLevel, status } = req.body;
  req.app.locals.state.zones[gridId] = {
    gridId,
    lat:              lat         || null,
    lng:              lng         || null,
    safetyLevel:      safetyLevel || 'amber',
    status:           status      || 'unknown',
    verified:         true,
    setByCoordinator: true,
    updatedAt:        new Date().toISOString()
  };
  req.app.locals.io.emit('zones:update', req.app.locals.state.zones);
  res.status(201).json(req.app.locals.state.zones[gridId]);
});

module.exports = router;