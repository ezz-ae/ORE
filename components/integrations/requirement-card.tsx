// components/integrations/requirement-card.tsx

'use client';

import React from 'react';
import { RequirementCard as IRequirementCard } from '@/types/freehold-mcp';

interface Props {
  card: IRequirementCard;
}

export function RequirementCard({ card }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-start gap-3">
        <span className="text-xl">
          {card.isMet ? '✅' : '❌'}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{card.description}</h3>
          {card.actionRequired && (
            <p className="text-sm text-gray-600">{card.actionRequired}</p>
          )}
        </div>
      </div>
    </div>
  );
}
