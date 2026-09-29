'use client';

import { useEffect, useRef } from 'react';

type ProjectViewPayload = {
  index: number;
  title?: string;
};

type PortfolioAnalyticsTrackerProps = {
  portfolioId: string | number;
  publicSlug: string;
};

const ANALYTICS_ENDPOINT = '/api/public/portfolio-analytics';

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PortfolioAnalyticsTracker({
  portfolioId,
  publicSlug,
}: PortfolioAnalyticsTrackerProps) {
  const sessionIdRef = useRef('');

  useEffect(() => {
    sessionIdRef.current ||= createSessionId();
    const startedAt = Date.now();
    const viewedProjects = new Set<number>();
    let lastDurationSent = -1;

    const sendPayload = (payload: { durationSeconds?: number; projectViews?: ProjectViewPayload[] }, preferBeacon = false) => {
      const body = {
        portfolioId,
        publicSlug,
        sessionId: sessionIdRef.current,
        ...payload,
      };
      const serialized = JSON.stringify(body);

      if (preferBeacon && navigator.sendBeacon) {
        const blob = new Blob([serialized], { type: 'application/json' });
        if (navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)) return;
      }

      void fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
        keepalive: true,
      }).catch(() => undefined);
    };

    const currentDuration = () => Math.max(0, Math.round((Date.now() - startedAt) / 1000));

    const flushDuration = (preferBeacon = false) => {
      const durationSeconds = currentDuration();
      if (!preferBeacon && durationSeconds === lastDurationSent) return;
      lastDurationSent = durationSeconds;
      sendPayload({ durationSeconds }, preferBeacon);
    };

    flushDuration();

    const intervalId = window.setInterval(() => {
      flushDuration();
    }, 15000);

    const projectNodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-portfolio-project-index]'),
    );

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting || entry.intersectionRatio < 0.35) return;
              const target = entry.target as HTMLElement;
              const index = Number(target.dataset.portfolioProjectIndex || 0);
              if (!index || viewedProjects.has(index)) return;
              viewedProjects.add(index);
              sendPayload({
                durationSeconds: currentDuration(),
                projectViews: [{
                  index,
                  title: target.dataset.portfolioProjectTitle || undefined,
                }],
              });
            });
          },
          { threshold: [0.35, 0.65] },
        )
      : null;

    if (observer) {
      projectNodes.forEach((node) => observer.observe(node));
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDuration(true);
      }
    };
    const handlePageHide = () => flushDuration(true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushDuration(true);
    };
  }, [portfolioId, publicSlug]);

  return null;
}
