import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { allPointsQuery } from "./data/useEvents.ts";

const queryClient = new QueryClient();

// Starts now rather than when the lazily loaded route mounts.
void queryClient.prefetchQuery(allPointsQuery);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</StrictMode>,
);
