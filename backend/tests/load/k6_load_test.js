/**
 * k6 Load Test for IMS Signal Ingestion
 * Run: k6 run tests/load/k6_load_test.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const signalCounter = new Counter('signals_sent');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 500 },    // Ramp up to 500 users
    { duration: '2m', target: 1000 },   // Sustain 1000 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    errors: ['rate<0.01'],              // Error rate under 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const API_KEY = 'signal-ingestion-api-key-2024';

const SIGNAL_TYPES = [
  'API_500_ERROR', 'API_TIMEOUT', 'SERVER_CPU_HIGH',
  'DB_SLOW_QUERY', 'CACHE_NODE_DOWN', 'QUEUE_LAG_HIGH',
];

const COMPONENTS = [
  'payment-api', 'checkout-api', 'auth-service',
  'postgres-primary', 'redis-cluster', 'app-server-01',
];

export default function () {
  const payload = JSON.stringify({
    signal_type: SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)],
    component_id: COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)],
    component_name: 'Load Test Service',
    severity: ['HIGH', 'MEDIUM', 'CRITICAL'][Math.floor(Math.random() * 3)],
    message: `k6 load test signal ${Math.floor(Math.random() * 100000)}`,
    source: 'k6-load-test',
    metadata: { load_test: true },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };

  const res = http.post(`${BASE_URL}/api/v1/signals`, payload, params);

  const success = check(res, {
    'status is 202': (r) => r.status === 202,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  signalCounter.add(1);
  responseTime.add(res.timings.duration);

  sleep(0.001);
}
