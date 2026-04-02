// backend/server.js
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const state = {
  tasks:      [],
  zones:      {},
  volunteers: {},
  supplies:   {},
  sosList:    [],
  camps:      []
};

app.locals.state = state;
app.locals.io    = io;

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/zones', require('./routes/zones'));
app.use('/api/sos',   require('./routes/sos'));
app.use('/api/sms',   require('./routes/sms'));

app.get('/api/health', (req, res) => {
  res.json({
    status:     'ok',
    volunteers: Object.keys(state.volunteers).length,
    tasks:      state.tasks.length,
    sos:        state.sosList.filter(s => s.status === 'active').length,
    timestamp:  new Date().toISOString()
  });
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.emit('state:full', state);

  socket.on('volunteer:checkin', (data) => {
    state.volunteers[data.id] = {
      ...data,
      socketId:  socket.id,
      lastSeen:  new Date().toISOString(),
      status:    data.status || 'available'
    };
    io.emit('volunteers:update', state.volunteers);
    console.log('👤 Volunteer checked in:', data.name || data.id);
  });

  socket.on('volunteer:location', (data) => {
    if (state.volunteers[data.id]) {
      state.volunteers[data.id].lat      = data.lat;
      state.volunteers[data.id].lng      = data.lng;
      state.volunteers[data.id].lastSeen = new Date().toISOString();
      io.emit('volunteers:update', state.volunteers);
    }
  });

  socket.on('zone:update', (data) => {
    const existing = state.zones[data.gridId];
    if (existing && existing.status !== data.status && !existing.verified) {
      state.zones[data.gridId] = {
        ...data,
        verified:     false,
        conflictWith: existing,
        updatedAt:    new Date().toISOString()
      };
    } else {
      state.zones[data.gridId] = {
        ...data,
        verified:  false,
        updatedAt: new Date().toISOString()
      };
      if (data.status !== 'cleared' && data.status !== 'safe') {
        setTimeout(() => {
          if (state.zones[data.gridId] && !state.zones[data.gridId].verified) {
            state.zones[data.gridId].verified = true;
            io.emit('zones:update', state.zones);
          }
        }, 15 * 60 * 1000);
      }
    }
    io.emit('zones:update', state.zones);
  });

  socket.on('zone:confirm', (data) => {
    if (state.zones[data.gridId]) {
      state.zones[data.gridId].verified    = true;
      state.zones[data.gridId].confirmedBy = data.coordinatorId;
      state.zones[data.gridId].confirmedAt = new Date().toISOString();
      io.emit('zones:update', state.zones);
    }
  });

  socket.on('supply:update', (data) => {
    const key = `${data.gridId}_${data.item}`;
    state.supplies[key] = { ...data, updatedAt: new Date().toISOString() };
    io.emit('supplies:update', state.supplies);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 CrisisSync backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});