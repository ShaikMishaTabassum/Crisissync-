// backend/routes/sos.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const active = req.app.locals.state.sosList.filter(s => s.status === 'active');
  res.json(active);
});

router.post('/', (req, res) => {
  const sos = {
    id:          uuidv4(),
    volunteerId: req.body.volunteerId || 'unknown',
    name:        req.body.name        || 'Unknown Volunteer',
    lat:         req.body.lat         || null,
    lng:         req.body.lng         || null,
    gridId:      req.body.gridId      || 'UNKNOWN',
    message:     req.body.message     || 'Emergency assistance needed',
    severity:    req.body.severity    || 'critical',
    source:      req.body.source      || 'app',
    status:      'active',
    timestamp:   new Date().toISOString()
  };
  req.app.locals.state.sosList.push(sos);

  req.app.locals.io.emit('sos:new', sos);
  console.log(`🚨 SOS triggered by ${sos.name} at grid ${sos.gridId}`);

  const sosTask = {
    id:             uuidv4(),
    title:          `🚨 SOS — ${sos.name}`,
    description:    sos.message,
    gridId:         sos.gridId,
    lat:            sos.lat,
    lng:            sos.lng,
    requiredSkills: ['first_aid'],
    priority:       'sos',
    status:         'open',
    sosId:          sos.id,
    assignedTo:     null,
    createdAt:      new Date().toISOString()
  };
  req.app.locals.state.tasks.push(sosTask);

  const allocator = require('../ai/allocator');
  const assigned  = allocator.findBestVolunteer(
    sosTask,
    req.app.locals.state.volunteers,
    req.app.locals.state.zones
  );
  if (assigned) {
    sosTask.assignedTo   = assigned.id;
    sosTask.assignedName = assigned.name;
    sosTask.status       = 'assigned';
    sosTask.assignedAt   = new Date().toISOString();
    if (req.app.locals.state.volunteers[assigned.id]) {
      req.app.locals.state.volunteers[assigned.id].status = 'busy';
    }
    console.log(`📋 SOS task auto-assigned to ${assigned.name}`);
  }
  req.app.locals.io.emit('tasks:update', req.app.locals.state.tasks);

  res.status(201).json(sos);
});

router.put('/:id/resolve', (req, res) => {
  const sos = req.app.locals.state.sosList.find(s => s.id === req.params.id);
  if (!sos) return res.status(404).json({ error: 'SOS not found' });
  sos.status     = 'resolved';
  sos.resolvedAt = new Date().toISOString();
  req.app.locals.io.emit('sos:resolved', sos);
  console.log(`✅ SOS resolved: ${sos.name}`);
  res.json(sos);
});

module.exports = router;