import { useState, useEffect } from 'react';

export function useSites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sites_full')
      .then(res => res.json())
      .then(data => {
        const extractedSites = data?.sites?.data || data?.sites || data || [];
        const sitesArray = Array.isArray(extractedSites) ? extractedSites : Object.values(extractedSites);
        const validSites = sitesArray.filter(s => s.latitude && s.longitude);
        setSites(validSites);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch sites", err);
        setLoading(false);
      });
  }, []);

  return { sites, loading };
}
