const axios  = require('axios');
const { io } = require('socket.io-client');
const API    = 'http://localhost:4000';
const socket = io(API);
async function seed() {
  console.log('?? Seeding demo data...');
  socket.emit('volunteer:checkin', {
    id: 'vol_priya', name: 'Priya Sharma',
    skills: ['first_aid', 'search_rescue'],
    lat: 17.3850, lng: 78.4867,
    gridId: 'D4', status: 'available'
  });
  await wait(200);
  socket.emit('volunteer:checkin', {
    id: 'vol_ravi', name: 'Ravi Kumar',
    skills: ['logistics', 'driving'],
    lat: 17.3920, lng: 78.4920,
    gridId: 'D5', status: 'available'
  });
  await wait(200);
  socket.emit('volunteer:checkin', {
    id: 'vol_meena', name: 'Meena Reddy',
    skills: ['medical', 'first_aid'],
    lat: 17.3780, lng: 78.4800,
    gridId: 'D3', status: 'available'
  });
  await wait(300);
  await axios.post(`${API}/api/zones`, { gridId: 'D4', lat: 17.3850, lng: 78.4867, safetyLevel: 'green', status: 'safe' });
  await axios.post(`${API}/api/zones`, { gridId: 'D5', lat: 17.3900, lng: 78.4900, safetyLevel: 'red', status: 'danger' });
  await axios.post(`${API}/api/zones`, { gridId: 'D3', lat: 17.3800, lng: 78.4840, safetyLevel: 'green', status: 'cleared' });
  await wait(200);
  const task = await axios.post(`${API}/api/tasks`, {
    title: 'Distribute ORS packets to Camp B',
    description: 'Camp B has 200 people and ORS running low.',
    gridId: 'D4', lat: 17.3850, lng: 78.4867,
    requiredSkills: ['logistics'], priority: 'high'
  });
  console.log('?? Task created:', task.data.title);
  console.log('   Assigned to:', task.data.assignedName || 'unassigned');
  console.log('? Done! Open http://localhost:3000');
  setTimeout(() => process.exit(0), 1000);
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
socket.on('connect', () => {
  console.log('? Connected to backend.');
  seed().catch(err => {
    console.error('? Error:', err.message);
    process.exit(1);
  });
});
socket.on('connect_error', () => {
  console.error('? Cannot reach backend. Run node server.js first.');
  process.exit(1);
});
