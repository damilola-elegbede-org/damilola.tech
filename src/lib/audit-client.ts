import type { AuditEventType, TrafficSource } from '@/lib/types';
import { captureTrafficSource, getTrafficSource } from '@/lib/traffic-source';

interface QueuedEvent {
  eventType: AuditEventType;
  path: string;
  section?: string;
  metadata: Record<string, unknown>;
  sessionId: string;
  userAgent: string;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30000; // 30 seconds
const SESSION_KEY = 'audit_session_id';

class AuditClient {
  private queue: QueuedEvent[] = [];
  private sessionId: string = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private trafficSource: TrafficSource | null = null;

  /**
   * Initialize the client (must be called in browser)
   */
  init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;

    // Get or create session ID
    this.sessionId = this.getOrCreateSessionId();

    // Capture traffic source on first visit
    this.trafficSource = captureTrafficSource();

    // Start flush interval
    this.startFlushInterval();

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Flush on visibility change (tab hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });

    this.isInitialized = true;
  }

  private getOrCreateSessionId(): string {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      // Fallback if localStorage not available
      return crypto.randomUUID();
    }
  }

  private startFlushInterval(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Track an event
   */
  track(
    eventType: AuditEventType,
    options: {
      section?: string;
      metadata?: Record<string, unknown>;
      includeTrafficSource?: boolean;
    } = {}
  ): void {
    if (typeof window === 'undefined') return;

    // Auto-init if not done
    if (!this.isInitialized) {
      this.init();
    }

    // Build metadata with optional traffic source
    const metadata: Record<string, unknown> = { ...options.metadata };
    if (options.includeTrafficSource && this.trafficSource) {
      metadata.trafficSource = this.trafficSource;
    }

    const event: QueuedEvent = {
      eventType,
      path: window.location.pathname,
      section: options.section,
      metadata,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
    };

    this.queue.push(event);

    // Flush if batch size reached
    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Get current traffic source
   */
  getTrafficSource(): TrafficSource | null {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.init();
    }
    return this.trafficSource || getTrafficSource();
  }

  /**
   * Flush queued events to server
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      // Use sendBeacon for reliability on page unload
      const useBeacon = typeof navigator.sendBeacon === 'function';

      if (useBeacon && document.visibilityState === 'hidden') {
        // Use Blob with Content-Type for proper JSON parsing on server
        navigator.sendBeacon(
          '/api/audit',
          new Blob([JSON.stringify(events)], { type: 'application/json' })
        );
      } else {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(events),
        });
      }
    } catch (error) {
      // Re-queue events on failure (but limit queue size)
      console.error('[audit] Failed to send events:', error);
      if (this.queue.length < BATCH_SIZE * 3) {
        this.queue.unshift(...events);
      }
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.init();
    }
    return this.sessionId;
  }
}

// Export singleton
export const auditClient = new AuditClient();

// Convenience function
export function trackEvent(
  eventType: AuditEventType,
  options?: {
    section?: string;
    metadata?: Record<string, unknown>;
    includeTrafficSource?: boolean;
  }
): void {
  auditClient.track(eventType, options);
}
