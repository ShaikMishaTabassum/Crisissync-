// frontend/src/components/SupplyPanel.jsx
import React from 'react';

export default function SupplyPanel({ supplyAlerts }) {
  if (!supplyAlerts || supplyAlerts.length === 0) return (
    <div style={{ padding: 16, background: '#e8f8f0', borderRadius: 8,
      border: '1px solid #2e8b57', color: '#2e8b57' }}>
      ✅ All camp supplies are at adequate levels
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
        Forecast based on current population and consumption rates:
      </p>
      {supplyAlerts.map((alert, i) => (
        <div key={i} style={{
          padding: 12, marginBottom: 8, borderRadius: 8,
          background: alert.severity === 'critical' ? '#fff0f0' : '#fff8e1',
          border: `2px solid ${alert.severity === 'critical' ? '#dc3545' : '#ffc107'}`
        }}>
          <b style={{ color: alert.severity === 'critical' ? '#dc3545' : '#856404' }}>
            {alert.severity === 'critical' ? '🔴' : '🟡'} {alert.message}
          </b>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Current stock: {alert.currentStock} | Incoming: {alert.incoming} | Population: {alert.population}
          </div>
        </div>
      ))}
    </div>
  );
}