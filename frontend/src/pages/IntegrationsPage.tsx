import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { TopBar } from '../components/dashboard/TopBar';

interface Props { onMenuClick?: () => void; }

export const IntegrationsPage: React.FC<Props> = ({ onMenuClick }) => {
  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data } = await apiClient.get('/integrations/config');
      return data;
    },
  });

  const apiBase = window.location.origin;

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Integrations" onMenuClick={onMenuClick || (() => {})} />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(data?.integrations || []).map((integration: any) => (
            <div key={integration.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{integration.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{integration.description}</p>
                </div>
                <span className={`badge text-xs ${integration.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {integration.status}
                </span>
              </div>
              {integration.endpoint && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook URL</p>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg block font-mono text-gray-700 dark:text-gray-300 break-all">
                    {apiBase}{integration.endpoint}
                  </code>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* API Key info */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Signal Ingestion API</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Send signals from any monitoring tool using the REST API.
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Endpoint</p>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg block font-mono">
                POST {apiBase}/api/v1/signals
              </code>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API Key Header</p>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg block font-mono">
                X-API-Key: signal-ingestion-api-key-2024
              </code>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sample Payload</p>
              <pre className="json-viewer text-xs">{JSON.stringify({
                signal_type: "API_500_ERROR",
                component_id: "payment-api",
                component_name: "Payment API",
                severity: "HIGH",
                message: "HTTP 500 error rate exceeded 5%",
                source: "datadog",
                metadata: { error_rate: 0.05, endpoint: "/checkout" }
              }, null, 2)}</pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
