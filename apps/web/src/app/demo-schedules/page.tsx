"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScheduleTemplates, ScheduleTemplatesTrigger } from '@/components/schedules';
import { useDeviceSchedules } from '@/hooks/use-device-schedules';
import { useToast } from '@/hooks/use-toast';
import type { ScheduleTemplate, ScheduleRecommendation } from '@/types/schedules';

/**
 * Demo page for Schedule Templates and AI Recommendations
 * This demonstrates TASK-025 and TASK-026 implementation
 */
export default function DemoSchedulesPage() {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const { schedules, loading, createSchedule, deleteSchedule, toggleActive } = useDeviceSchedules();
  const { toast } = useToast();

  // Mock room and controller IDs for demo
  const DEMO_ROOM_ID = '00000000-0000-0000-0000-000000000001';
  const DEMO_CONTROLLER_ID = '00000000-0000-0000-0000-000000000002';

  function handleApplyTemplate(template: ScheduleTemplate) {
    toast({
      title: 'Template Selected',
      description: `Applying "${template.name}" template with ${template.schedules.length} schedules`,
    });

    // In a real implementation, you would:
    // 1. Map template schedules to actual controller ports
    // 2. Create device_schedule records for each schedule item
    // 3. Show a configuration dialog for port assignments

    console.log('Template to apply:', template);

    // Example: Create schedules from template
    template.schedules.forEach(async (scheduleItem, index) => {
      const result = await createSchedule({
        controller_id: DEMO_CONTROLLER_ID,
        room_id: DEMO_ROOM_ID,
        name: scheduleItem.name,
        description: scheduleItem.description || template.description,
        device_port: index + 1, // This should be selected by user in real app
        trigger_type: scheduleItem.trigger_type,
        schedule: scheduleItem.schedule,
        is_active: true,
      });

      if (!result.success) {
        console.error('Failed to create schedule:', result.error);
      }
    });

    toast({
      title: 'Schedules Created',
      description: `Created ${template.schedules.length} schedules from template`,
    });
  }

  function handleApplyRecommendation(recommendation: ScheduleRecommendation) {
    toast({
      title: 'AI Recommendation Accepted',
      description: `Applying ${recommendation.suggestedSchedules.length} recommended schedules`,
    });

    console.log('Recommendation to apply:', recommendation);

    // Similar to template application
    recommendation.suggestedSchedules.forEach(async (scheduleItem, index) => {
      const result = await createSchedule({
        controller_id: DEMO_CONTROLLER_ID,
        room_id: DEMO_ROOM_ID,
        name: scheduleItem.name,
        description: scheduleItem.description || recommendation.rationale,
        device_port: index + 1,
        trigger_type: scheduleItem.trigger_type,
        schedule: scheduleItem.schedule,
        is_active: true,
      });

      if (!result.success) {
        console.error('Failed to create schedule:', result.error);
      }
    });

    toast({
      title: 'AI Schedules Applied',
      description: `Created ${recommendation.suggestedSchedules.length} AI-recommended schedules`,
    });
  }

  async function handleToggleSchedule(id: string, isActive: boolean) {
    const result = await toggleActive(id, isActive);
    if (result.success) {
      toast({
        title: isActive ? 'Schedule Enabled' : 'Schedule Disabled',
        description: `Schedule has been ${isActive ? 'activated' : 'deactivated'}`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to toggle schedule',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteSchedule(id: string) {
    const result = await deleteSchedule(id);
    if (result.success) {
      toast({
        title: 'Schedule Deleted',
        description: 'Schedule has been removed',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Schedule Templates Demo</h1>
        <p className="text-muted-foreground">
          TASK-025: Schedule Templates + TASK-026: Smart Recommendations
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter((s) => s.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Template Gallery</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleTemplatesTrigger
              onClick={() => setTemplatesOpen(true)}
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features Implemented</CardTitle>
          <CardDescription>TASK-025 and TASK-026 deliverables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">TASK-025: Schedule Templates</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Template gallery with multiple categories</li>
                <li>✓ Featured templates highlighting</li>
                <li>✓ Search and filter functionality</li>
                <li>✓ Pre-configured schedules for common scenarios</li>
                <li>✓ Template metadata (difficulty, tags, required devices)</li>
                <li>✓ One-click template application</li>
                <li>✓ Customizable after selection</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">TASK-026: Smart Recommendations</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ AI-powered schedule analysis</li>
                <li>✓ Sensor history integration</li>
                <li>✓ Growth stage awareness</li>
                <li>✓ Target condition optimization</li>
                <li>✓ Confidence scoring</li>
                <li>✓ Detailed rationale explanation</li>
                <li>✓ Accept/ignore functionality</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Current Schedules</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${schedules.length} schedule(s) configured`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No schedules configured yet. Browse templates to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{schedule.name}</span>
                      <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                        {schedule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {schedule.trigger_type}
                      </Badge>
                    </div>
                    {schedule.description && (
                      <p className="text-sm text-muted-foreground">{schedule.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Port {schedule.device_port} | Action: {schedule.schedule.action}
                      {schedule.schedule.level !== undefined && ` (${schedule.schedule.level}%)`}
                      {schedule.schedule.start_time && ` | Time: ${schedule.schedule.start_time}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleSchedule(schedule.id, !schedule.is_active)}
                    >
                      {schedule.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>New endpoints created for this feature</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <Badge variant="outline" className="mr-2">
                GET
              </Badge>
              /api/templates
            </div>
            <div>
              <Badge variant="outline" className="mr-2">
                POST
              </Badge>
              /api/schedules/recommend
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Templates Dialog */}
      <ScheduleTemplates
        roomId={DEMO_ROOM_ID}
        controllerId={DEMO_CONTROLLER_ID}
        growthStage="vegetative"
        targetConditions={{
          temperature_min: 20,
          temperature_max: 26,
          humidity_min: 50,
          humidity_max: 70,
          vpd_min: 0.8,
          vpd_max: 1.2,
        }}
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onApplyTemplate={handleApplyTemplate}
        onApplyRecommendation={handleApplyRecommendation}
      />
    </div>
  );
}
