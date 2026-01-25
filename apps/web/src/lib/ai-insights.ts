'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface AIInsight {
  id: string;
  query: string;
  data_type: string;
  analysis: string;
  confidence: number;
  recommendations: string[];
  created_at: string;
}

/**
 * React hook for subscribing to real-time AI insights
 * 
 * Usage:
 * const { insights, loading } = useAIInsights();
 */
export function useAIInsights() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Fetch initial insights
    const fetchInsights = async () => {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!isMounted.current) return;

      if (!error && data) {
        setInsights(data);
      }
      setLoading(false);
    };

    fetchInsights();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('ai-insights-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_insights',
        },
        (payload) => {
          if (!isMounted.current) return;
          setInsights((current) => [payload.new as AIInsight, ...current]);
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { insights, loading };
}

/**
 * Function to trigger AI analysis
 */
export async function triggerAnalysis(
  query: string,
  dataType: string,
  timeRange?: { start: string; end: string }
) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      dataType,
      timeRange,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Analysis failed');
  }

  return response.json();
}
