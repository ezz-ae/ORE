// app/freehold-intelligence/integrations/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { IntegrationStatusCard } from '@/components/integrations/integration-status-card';
import { LaunchBlockerCard } from '@/components/integrations/launch-blocker-card';
import { RequirementCard } from '@/components/integrations/requirement-card';
import { McpResponseEnvelope } from '@/types/freehold-mcp';

interface Integration {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'pending';
  description: string;
}

interface LaunchBlocker {
  id: string;
  integrationId: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  resolutionSteps: string[];
}

export default function IntegrationDashboard() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [blockers, setBlockers] = useState<LaunchBlocker[]>([]);
  const [canLaunch, setCanLaunch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch integrations
        const intRes = await fetch('/api/freehold/integrations');
        const intData = (await intRes.json()) as McpResponseEnvelope<Integration[]>;
        if (intData.status === 'success' && intData.data) {
          setIntegrations(intData.data);
        }

        // Fetch launch blockers
        const blockRes = await fetch('/api/freehold/integrations/launch-blockers');
        const blockData = (await blockRes.json()) as McpResponseEnvelope<any>;
        if (blockData.status === 'success' && blockData.data) {
          setBlockers(blockData.data.blockers || []);
          setCanLaunch(blockData.data.canLaunch || false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConnect = (integrationId: string) => {
    // In a real implementation, this would initiate OAuth flow
    console.log(`Connecting to ${integrationId}`);
    alert(`OAuth flow would start for ${integrationId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-600">Loading integration dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  const criticalBlockers = blockers.filter(b => b.severity === 'critical');
  const warnings = blockers.filter(b => b.severity === 'warning');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Integration Dashboard</h1>
          <p className="text-gray-600">Manage your Freehold Intelligence integrations</p>
        </div>

        {/* Launch Status */}
        <div className={`mb-8 p-4 rounded-lg border ${canLaunch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{canLaunch ? '🚀' : '⛔'}</span>
            <div>
              <h2 className="text-lg font-semibold">
                {canLaunch ? 'Ready to Launch' : `${criticalBlockers.length} Critical Issue(s) Blocking Launch`}
              </h2>
              <p className={`text-sm ${canLaunch ? 'text-green-700' : 'text-red-700'}`}>
                {canLaunch
                  ? 'All critical requirements have been met'
                  : 'Please resolve the issues below before launching'}
              </p>
            </div>
          </div>
        </div>

        {/* Critical Blockers */}
        {criticalBlockers.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">🔴 Critical Issues</h2>
            <div className="space-y-4">
              {criticalBlockers.map(blocker => (
                <LaunchBlockerCard key={blocker.id} card={blocker} />
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">⚠️ Warnings</h2>
            <div className="space-y-4">
              {warnings.map(blocker => (
                <LaunchBlockerCard key={blocker.id} card={blocker} />
              ))}
            </div>
          </div>
        )}

        {/* Integration Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Integration Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map(integration => (
              <IntegrationStatusCard
                key={integration.id}
                card={{
                  type: 'IntegrationStatusCard',
                  integrationId: integration.id,
                  name: integration.name,
                  status: integration.status,
                  details: integration.description,
                  connectUrl: `/api/freehold/integrations/${integration.id}/oauth/start`,
                }}
                onConnect={handleConnect}
              />
            ))}
          </div>
        </div>

        {/* API Testing Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">API Testing</h2>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-gray-600 mb-4">
              Test the API endpoints using curl or your favorite API client:
            </p>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto text-gray-800">
{`# List all integrations
curl http://localhost:3000/api/freehold/integrations

# Get specific integration
curl http://localhost:3000/api/freehold/integrations/hubspot

# Get integration requirements
curl http://localhost:3000/api/freehold/integrations/hubspot/requirements

# Get sync logs
curl http://localhost:3000/api/freehold/integrations/hubspot/sync-logs

# Test integration
curl -X POST http://localhost:3000/api/freehold/integrations/hubspot/test

# Get launch blockers
curl http://localhost:3000/api/freehold/integrations/launch-blockers

# List MCP tools
curl http://localhost:3000/api/freehold/mcp/tools

# Call MCP tool
curl -X POST http://localhost:3000/api/freehold/mcp/call \\
  -H "Content-Type: application/json" \\
  -d '{"toolName": "server-summary", "args": {}}'`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
