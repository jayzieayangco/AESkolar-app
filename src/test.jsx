import { useEffect } from "react";
import { testSupabaseConnection, listDocuments } from "./services/api.js";

export default function TestFetch() {
  useEffect(() => {
    async function run() {
      const connection = await testSupabaseConnection();
      console.log("[Test] connection:", connection);

      const { data, error } = await listDocuments();
      if (error) {
        console.error("[Test] listDocuments failed:", error);
      } else {
        console.log("[Test] documents:", data);
      }
    }

    run();
  }, []);

  return <h1>Check the Console (F12) for Supabase test results</h1>;
}
