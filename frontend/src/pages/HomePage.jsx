import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export default function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.get("/health");
      return response.data;
    },
  });

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-medium">Setup complete</h2>
      <p className="text-slate-600">
        Backend status:{" "}
        <span className="font-mono">
          {isPending ? "checking..." : isError ? "unreachable" : data?.status}
        </span>
      </p>
    </section>
  );
}
