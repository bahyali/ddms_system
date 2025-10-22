import createClient from 'openapi-fetch';
import type { paths } from '@ddms/sdk';

// For client-side requests, this will be proxied by Next.js rewrites
// to the API server running on http://localhost:3001
const baseUrl = typeof window === 'undefined' ? 'http://localhost:3001/api/v1' : '/api/v1';

const api = createClient<paths>({
  baseUrl,
});

export default api;