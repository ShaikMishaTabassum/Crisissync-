// backend/routes/tasks.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  res.json(req.app.locals.state.tasks);
});

router.post('/', (req, res) => {
  const task = {
    id:             uuidv4(),
    title:          req.body.title          || 'Untitled Task',
    description:    req.body.description    || '',
    gridId:         req.body.gridId         || 'UNKNOWN',
    lat:            req.body.lat            || null,
    lng:            req.body.lng            || null,
    requiredSkills: req.body.requiredSkills || [],
    priority:       req.body.priority       || 'normal',
    status:         'open',
    assignedTo:     null,
    createdAt:      new Date().toISOString()
  };

  req.app.locals.state.tasks.push(task);

  const allocator = require('../ai/allocator');
  const assigned  = allocator.findBestVolunteer(
    task,
    req.app.locals.state.volunteers,
    req.app.locals.state.zones
  );
  if (assigned) {
    task.assignedTo   = assigned.id;
    task.assignedName = assigned.name;
    task.status       = 'assigned';
    task.assignedAt   = new Date().toISOString();
    req.app.locals.state.volunteers[assigned.id].status     = 'busy';
    req.app.locals.state.volunteers[assigned.id].lastTaskAt = new Date().toISOString();
    console.log(`📋 Task '${task.title}' auto-assigned to ${assigned.name}`);
  }

  req.app.locals.io.emit('tasks:update', req.app.locals.state.tasks);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const task = req.app.locals.state.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  Object.assign(task, req.body, { updatedAt: new Date().toISOString() });

  if (req.body.status === 'completed' && task.assignedTo) {
    const vol = req.app.locals.state.volunteers[task.assignedTo];
    if (vol) vol.status = 'available';
  }

  req.app.locals.io.emit('tasks:update', req.app.locals.state.tasks);
  res.json(task);
});

module.exports = router;