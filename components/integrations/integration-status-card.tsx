// components/integrations/integration-status-card.tsx

'use client';

import React from 'react';
import { IntegrationStatusCard as IIntegrationStatusCard } from '@/types/freehold-mcp';

interface Props {
  card: IIntegrationStatusCard;
  onConnect?: (integrationId: string) => void;
}

export function IntegrationStatusCard({ card, onConnect }: Props) {
  const statusColor = {
    connected: 'bg-green-50 border-green-200',
    disconnected: 'bg-red-50 border-red-200',
    pending: 'bg-yellow-50 border-yellow-200',
  };

  const statusBadgeColor = {
    connected: 'bg-green-100 text-green-800',
    disconnected: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className={`border rounded-lg p-4 ${statusColor[card.status]}`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold">{card.name}</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeColor[card.status]}`}>
          {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
        </span>
      </div>

      {card.lastSync && (
        <p className="text-sm text-gray-600 mb-3">
          Last sync: {new Date(card.lastSync).toLocaleString()}
        </p>
      )}

      {card.details && <p className="text-sm text-gray-700 mb-3">{card.details}</p>}

      {card.status !== 'connected' && (
        <button
          onClick={() => onConnect?.(card.integrationId)}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          Connect
        </button>
      )}
    </div>
  );
}
