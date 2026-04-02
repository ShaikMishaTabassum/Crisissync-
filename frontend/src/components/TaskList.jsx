// frontend/src/components/TaskList.jsx
import React from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

const PRIORITY_COLORS = {
  sos:    { bg: '#fff0f0', border: '#dc3545', badge: '#dc3545' },
  high:   { bg: '#fff8f0', border: '#fd7e14', badge: '#fd7e14' },
  normal: { bg: '#f8f9fa', border: '#dee2e6', badge: '#6c757d' },
  low:    { bg: '#ffffff', border: '#dee2e6', badge: '#adb5bd' },
};

export default function TaskList({ tasks }) {
  const markDone = async (id) => {
    try { await axios.put(`${API}/api/tasks/${id}`, { status: 'completed' }); }
    catch (e) { alert('Error updating task'); }
  };

  if (tasks.length === 0) return (
    <p style={{ color: '#888', padding: 16 }}>No tasks yet. Create one using the button above.</p>
  );

  return (
    <div>
      {tasks.map(task => {
        const colors = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal;
        return (
          <div key={task.id} style={{
            padding: 12, marginBottom: 8, borderRadius: 8,
            background: colors.bg, border: `2px solid ${colors.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{
                  background: colors.badge, color: '#fff',
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, marginRight: 8
                }}>{task.priority.toUpperCase()}</span>
                <b>{task.title}</b>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 10,
                  background: task.status === 'completed' ? '#d4edda' : task.status === 'assigned' ? '#cce5ff' : '#fff3cd',
                  color: task.status === 'completed' ? '#155724' : task.status === 'assigned' ? '#004085' : '#856404'
                }}>{task.status}</span>
                {task.status !== 'completed' && (
                  <button onClick={() => markDone(task.id)} style={{
                    fontSize: 11, padding: '2px 8px', border: '1px solid #ccc',
                    borderRadius: 6, cursor: 'pointer', background: '#fff'
                  }}>✓ Done</button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Grid: {task.gridId}
              {task.assignedName && ` | Assigned to: ${task.assignedName}`}
              {task.requiredSkills && task.requiredSkills.length > 0 && ` | Skills: ${task.requiredSkills.join(', ')}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}