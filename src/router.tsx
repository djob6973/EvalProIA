import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,      // 5 min — don't refetch while data is fresh
        gcTime: 10 * 60 * 1000,         // 10 min — keep unused cache entries
        retry: 1,
        refetchOnWindowFocus: false,    // avoid spurious refetches on tab switch
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
