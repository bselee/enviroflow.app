/**
 * Schedules Page
 *
 * Device schedule management page with visual weekly calendar grid.
 * Accessible from the dashboard navigation and controller device cards.
 */

import { AppLayout } from "@/components/layout/AppLayout";
import { ScheduleBuilder } from "@/components/schedules/ScheduleBuilder";

export default function SchedulesPage() {
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <ScheduleBuilder />
      </div>
    </AppLayout>
  );
}
