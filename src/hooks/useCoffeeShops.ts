import { useState, useEffect } from 'react';

export interface CoffeeShop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  rating?: number;       // 0-10 scale
  price?: number;        // 1-4 ($-$$$$)
  distance?: number;     // meters from center
}

/**
 * Loads coffee shop data from a static JSON file generated at build time
 * by scripts/fetch-coffee.mjs. The Foursquare Places API doesn't support
 * CORS, so we pre-fetch server-side during the build.
 */
export function useCoffeeShops() {
  const [shops, setShops] = useState<CoffeeShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadShops() {
      try {
        setLoading(true);
        const response = await fetch(
          `${import.meta.env.BASE_URL}coffee-shops.json`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error('Coffee shop data not available — rebuild required');
        }

        const json = await response.json();
        setShops(json.shops ?? []);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadShops();
    return () => controller.abort();
  }, []);

  return { shops, loading, error };
}
