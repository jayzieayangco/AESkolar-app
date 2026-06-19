import { useEffect, useState } from "react";
import { testSupabaseConnection } from "../services/api.js";

/**
 * Drop into any route temporarily to verify env vars, auth, and RLS.
 * Example: <Route path="/db-test" element={<SupabaseConnectionTest />} />
 */
export default function SupabaseConnectionTest() {
  const [status, setStatus] = useState({ loading: true, ok: null, message: "" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await testSupabaseConnection();
      if (!cancelled) {
        setStatus({ loading: false, ok: result.ok, message: result.message });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Supabase connection test</h1>
      {status.loading ? (
        <p>Testing connection…</p>
      ) : (
        <p style={{ color: status.ok ? "green" : "crimson" }}>{status.message}</p>
      )}
      <p>Open DevTools → Console for detailed RLS error codes if the test fails.</p>
    </div>
  );
}
