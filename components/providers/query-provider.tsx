"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { useConvex } from "convex/react";
import { useState, useEffect } from "react";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const convex = useConvex();
  const [queryClient, setQueryClient] = useState<QueryClient | null>(null);

  useEffect(() => {
    const convexQueryClient = new ConvexQueryClient(convex);
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          queryKeyHashFn: convexQueryClient.hashFn(),
          queryFn: convexQueryClient.queryFn(),
          gcTime: 5 * 60 * 1000, // 5 minutes  
          refetchOnWindowFocus: false,
        },
      },
    });
    convexQueryClient.connect(client);
    setQueryClient(client);
  }, [convex]);

  if (!queryClient) {
    return null; // or a loading spinner
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}