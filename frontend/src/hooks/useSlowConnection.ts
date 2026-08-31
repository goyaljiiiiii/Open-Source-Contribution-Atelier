import { useState, useEffect } from 'react';

export function useSlowConnection(latencyThresholdMs: number = 1500) {
  const [isConnectionSlow, setIsConnectionSlow] = useState<boolean>(false);

  useEffect(() => {
    // Custom window event listener to intercept API telemetry duration logs
    const handleLatencyMetric = (event: Event) => {
      const customEvent = event as CustomEvent<{ duration: number }>;
      if (customEvent.detail && typeof customEvent.detail.duration === 'number') {
        const currentLatency = customEvent.detail.duration;
        
        if (currentLatency > latencyThresholdMs) {
          setIsConnectionSlow(true);
        } else {
          setIsConnectionSlow(false);
        }
      }
    };

    // Fallback support checking the Network Information API downlinks if supported
    const checkNetworkSpeedFallback = () => {
      const nav = navigator as any;
      const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
      if (connection) {
        // A round-trip time (rtt) estimate >= 1500ms indicates highly unstable pathways
        if (connection.rtt >= 1500 || connection.downlink < 0.5) {
          setIsConnectionSlow(true);
        } else {
          setIsConnectionSlow(false);
        }
      }
    };

    window.addEventListener('api-latency-metric', handleLatencyMetric);
    
    // Periodically inspect structural system connectivity bounds
    const fallbackInterval = setInterval(checkNetworkSpeedFallback, 4000);
    checkNetworkSpeedFallback();

    return () => {
      window.removeEventListener('api-latency-metric', handleLatencyMetric);
      clearInterval(fallbackInterval);
    };
  }, [latencyThresholdMs]);

  return { isConnectionSlow };
}
