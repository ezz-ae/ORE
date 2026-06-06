// components/integrations/launch-blocker-card.tsx

'use client';

import React from 'react';
import { LaunchBlockerCard as ILaunchBlockerCard } from '@/types/freehold-mcp';

interface Props {
  card: ILaunchBlockerCard;
}

export function LaunchBlockerCard({ card }: Props) {
  const severityColor = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const severityIcon = {
    critical: '🔴',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const sev = card.severity ?? 'warning'
  return (
    <div className={`border rounded-lg p-4 ${severityColor[sev]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{severityIcon[sev]}</span>
        <div className="flex-1">
          <h3 className="font-semibold mb-2">{card.message}</h3>
          <div className="text-sm">
            <p className="font-medium mb-2">Resolution Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              {card.resolutionSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
