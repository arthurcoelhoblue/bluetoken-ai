/**
 * Web Vitals monitoring — reports LCP, CLS, INP, FCP, TTFB
 * to the analytics_events table for observability.
 */
import type { Metric } from 'web-vitals';
import { onLCP, onCLS, onINP, onFCP, onTTFB } from 'web-vitals';
import { supabase } from '@/integrations/supabase/client';

function reportMetric(metric: Metric) {
  const rating = metric.rating; // 'good' | 'needs-improvement' | 'poor'
  
  // Only report to DB if poor or needs-improvement (reduce noise)
  if (rating === 'good') return;

  supabase.from('analytics_events').insert({
    event_name: `webvital_${metric.name.toLowerCase()}`,
    event_category: 'performance',
    empresa: 'BLUE', // Will be overridden by RLS context
    metadata: {
      name: metric.name,
      value: Math.round(metric.value * 100) / 100,
      rating,
      delta: Math.round(metric.delta * 100) / 100,
      navigationType: metric.navigationType,
      url: window.location.pathname,
    },
  }).then(() => { /* fire and forget */ });
}

export function initWebVitals() {
  onLCP(reportMetric);
  onCLS(reportMetric);
  onINP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
}
