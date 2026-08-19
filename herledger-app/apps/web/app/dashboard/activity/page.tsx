import type { Metadata } from "next";

import { ActivityList } from "@/components/activity/activity-list";

export const metadata: Metadata = { title: "Financial Activity" };

export default function ActivityPage() {
  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Financial Activity
      </h1>
      <ActivityList />
    </div>
  );
}
