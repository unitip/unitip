"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren } from "react";

const queryClient = new QueryClient();

export default function Provider(props: PropsWithChildren) {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </>
  );
}