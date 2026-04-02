// backend/routes/sms.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

router.post('/incoming', (req, res) => {
  const from    = req.body.From  || 'unknown';
  const rawBody = req.body.Body  || '';
  const body    = rawBody.trim().toUpperCase();
  const parts   = body.split(' ');
  const command = parts[0];
  const state   = req.app.locals.state;
  const io      = req.app.locals.io;

  let responseMsg = '';
  console.log(`📱 SMS from ${from}: ${rawBody}`);

  if (command === 'SOS') {
    const gridId = parts[1] || 'UNKNOWN';
    const sos = {
      id: uuidv4(), volunteerId: from,
      name: `SMS User ${from.slice(-4)}`,
      lat: null, lng: null, gridId,
      message: 'SOS via SMS',
      severity: 'critical', status: 'active',
      source: 'sms', timestamp: new Date().toISOString()
    };
    state.sosList.push(sos);
    io.emit('sos:new', sos);
    responseMsg = `SOS received for grid ${gridId}. Help being dispatched. Stay where you are.`;

  } else if (command === 'CLEAR') {
    const gridId = parts[1] || 'UNKNOWN';
    state.zones[gridId] = {
      gridId, status: 'cleared', verified: false,
      source: 'sms', reportedBy: from,
      updatedAt: new Date().toISOString()
    };
    io.emit('zones:update', state.zones);
    responseMsg = `Grid ${gridId} marked cleared (UNVERIFIED). Coordinator will confirm.`;

  } else if (command === 'NEED') {
    const item   = parts[1] || 'unknown';
    const gridId = parts[2] || 'UNKNOWN';
    const qty    = parseInt(parts[3]) || 0;
    const key    = `${gridId}_${item}`;
    state.supplies[key] = {
      gridId, item, qty, reportedBy: from,
      status: 'needed', source: 'sms',
      updatedAt: new Date().toISOString()
    };
    io.emit('supplies:update', state.supplies);
    responseMsg = `Supply logged: ${qty} units of ${item} needed at ${gridId}.`;

  } else if (command === 'JOIN') {
    state.volunteers[from] = {
      id: from,
      name: `SMS Volunteer ${from.slice(-4)}`,
      phone: from, skills: ['general'],
      source: 'sms', status: 'available',
      lastSeen: new Date().toISOString()
    };
    io.emit('volunteers:update', state.volunteers);
    responseMsg = `Welcome to CrisisSync! Commands: SOS [grid] | CLEAR [grid] | NEED [item] [grid] [qty]`;

  } else {
    responseMsg = `Unknown command. Send: SOS D4 | CLEAR D4 | NEED water D4 50 | JOIN 123456`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Message>${responseMsg}</Message></Response>`);
});

module.exports = router;