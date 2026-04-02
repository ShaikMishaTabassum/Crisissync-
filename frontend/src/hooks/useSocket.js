// frontend/src/hooks/useSocket.js
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [zones, setZones] = useState({});
  const [volunteers, setVolunteers] = useState({});
  const [sosList, setSosList] = useState([]);
  const [supplies, setSupplies] = useState({});
  const [supplyAlerts, setSupplyAlerts] = useState([]);

  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('state:full', (s) => {
      setTasks(s.tasks || []);
      setZones(s.zones || {});
      setVolunteers(s.volunteers || {});
      setSosList((s.sosList || []).filter(x => x.status === 'active'));
      setSupplies(s.supplies || {});
    });

    socket.on('tasks:update', setTasks);
    socket.on('zones:update', setZones);
    socket.on('volunteers:update', setVolunteers);
    socket.on('supplies:update', setSupplies);
    socket.on('supply:alerts', setSupplyAlerts);
    socket.on('sos:new', (sos) => setSosList(prev => [...prev, sos]));
    socket.on('sos:resolved', (sos) => setSosList(prev => prev.filter(s => s.id !== sos.id)));

    return () => socket.disconnect();
  }, []);

  const emit = (event, data) => {
    if (socketRef.current) socketRef.current.emit(event, data);
  };

  return { connected, tasks, zones, volunteers, sosList, supplies, supplyAlerts, emit };
}