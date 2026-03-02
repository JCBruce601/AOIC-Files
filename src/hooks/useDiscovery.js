import { useState, useCallback, useRef } from "react";
import { discoverAssets } from "../utils/api.js";

export function useDiscovery() {
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef(null);

  const search = useCallback(async (params) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await discoverAssets(params);
      if (!controller.signal.aborted) {
        setResults(data.results || []);
        setTotalResults(data.resultSetSize || 0);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message);
        setResults([]);
        setTotalResults(0);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setTotalResults(0);
    setHasSearched(false);
    setError(null);
  }, []);

  return { results, totalResults, loading, error, hasSearched, search, reset };
}
