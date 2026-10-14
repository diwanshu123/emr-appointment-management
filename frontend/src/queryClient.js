import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Retry only network failures / 5xx. Retrying a 4xx never helps.
      retry: (count, error) => (!error.response || error.response.status >= 500) && count < 2,
    },
  },
});
