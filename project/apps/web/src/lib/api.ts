import createClient from 'openapi-fetch';
import type { paths } from '@ddms/sdk';

// For client-side requests, this will be proxied by Next.js rewrites
// to the API server running on http://localhost:3001
const apiBaseUrl =
  (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

// Temporary development credentials so the web app can talk to the API without a full auth flow.
const devTenantId =
  process.env.NEXT_PUBLIC_TENANT_ID ??
  '11111111-1111-1111-1111-111111111111';
const devJwt =
  process.env.NEXT_PUBLIC_DEV_JWT ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlciIsInJvbGVzIjpbImFkbWluIl0sInRlbmFudF9pZCI6IjExMTExMTExLTExMTEtMTExMS0xMTExLTExMTExMTExMTExMSJ9.6HPdCV5lI1DUoGLrQa4u0pgdOZW86CPZta6s5Z7ZPBk';

export const apiDefaultHeaders: Record<string, string> = {};
if (devTenantId) {
  apiDefaultHeaders['x-tenant-id'] = devTenantId;
}
if (devJwt) {
  apiDefaultHeaders.Authorization = `Bearer ${devJwt}`;
}

const api = createClient<paths>({
  baseUrl: apiBaseUrl,
  headers: {
    ...apiDefaultHeaders,
  },
});

export default api;
