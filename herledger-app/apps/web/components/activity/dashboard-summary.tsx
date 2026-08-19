"use client";

import { useEffect, useState } from "react";

import type { FinancialEventDto } from "@/app/api/activity/recent/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useEventStream } from "@/hooks/use-event-stream";
import { apiClient } from "@/lib/api/client";
import { formatAmount } from "@/lib/utils/format";

export function DashboardSummary() {
  const [events, setEvents] = useState<FinancialEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { newEvents } = useEventStream();

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await apiClient.activity.recent();
        setEvents(data.events);
      } catch {
        setError("Could not load recent activity. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void fetchSummary();
  }, []);

  useEffect(() => {
    async function refetchSummary() {
      try {
        const data = await apiClient.activity.recent();
        setEvents(data.events);
      } catch {
        setError("Could not load recent activity. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    if (newEvents.length > 0) {
      void refetchSummary();
    }
  }, [newEvents]);

  if (loading) return <LoadingSpinner label="Loading activity…" />;
  if (error) {
    return (
      <div role="alert" style={{ color: "var(--danger)", fontSize: "0.9375rem" }}>
        {error}
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <EmptyState
        title="No verified financial activity yet."
        description="Once your business is registered and supported Stellar transactions are detected, your activity will appear here."
      />
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
        Recent activity
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {events.map((event) => (
          <li
            key={event.eventId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <span style={{ fontWeight: 500, fontSize: "0.9375rem" }}>
                {formatEventType(event.eventType)}
              </span>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                Ledger {event.ledgerSequence}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.9375rem" }}>
                {formatAmount(BigInt(event.amount))}
              </span>
              <StatusBadge status={event.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    PaymentReceived: "Payment received",
    PaymentSent: "Payment sent",
    InvoiceSettled: "Invoice settled",
    CommitmentFulfilled: "Commitment fulfilled",
  };
  return labels[type] ?? type;
}
