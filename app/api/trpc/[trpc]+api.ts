import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createContext } from '../../../backend/trpc/create-context';
import { appRouter } from '../../../backend/trpc/app-router';
import { NextRequest } from 'next/server';

const handler = async (req: NextRequest) => {
  console.log(`[TRPC API Handler] Received ${req.method} request for ${req.url}`);

  if (req.method === 'POST') {
    try {
      // Clone the request to read its body for logging 
      // without consuming the original request's body stream.
      const reqCloneForLogging = req.clone();
      const bodyText = await reqCloneForLogging.text();
      console.log('[TRPC API Handler] Raw POST body (read from cloned request for logging):', bodyText);
    } catch (e) {
      console.error('[TRPC API Handler] Error reading POST body for logging:', e);
    }
  }

  // The original 'req' object's body should still be available here for fetchRequestHandler
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req, // Pass the original request object
    router: appRouter,
    createContext: createContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`,
              error,
            );
          }
        : undefined,
  });
};

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH, handler as OPTIONS };
