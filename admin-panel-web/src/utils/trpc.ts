import { createTRPCReact } from '@trpc/react-query';
// Use the path alias defined in tsconfig.app.json
// import type { AppRouter } from '@backend/trpc/app-router'; // Temporarily comment out for diagnostics

// This is the tRPC hooks object that you'll use in your components.
export const trpc = createTRPCReact<any>(); // Using any to diagnose if AppRouter type is the sole linter issue