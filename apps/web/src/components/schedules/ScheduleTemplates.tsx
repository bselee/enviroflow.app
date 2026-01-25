"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TemplateGallery } from './TemplateGallery';
import { ScheduleRecommendation } from './ScheduleRecommendation';
import type { ScheduleTemplate, ScheduleRecommendation as ScheduleRecommendationType } from '@/types/schedules';

interface ScheduleTemplatesProps {
  roomId: string;
  controllerId?: string;
  growthStage?: string;
  targetConditions?: {
    temperature_min?: number;
    temperature_max?: number;
    humidity_min?: number;
    humidity_max?: number;
    vpd_min?: number;
    vpd_max?: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (template: ScheduleTemplate) => void;
  onApplyRecommendation: (recommendation: ScheduleRecommendationType) => void;
}

export function ScheduleTemplates({
  roomId,
  controllerId,
  growthStage,
  targetConditions,
  open,
  onOpenChange,
  onApplyTemplate,
  onApplyRecommendation,
}: ScheduleTemplatesProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'ai'>('templates');

  function handleSelectTemplate(template: ScheduleTemplate) {
    onApplyTemplate(template);
    onOpenChange(false);
  }

  function handleAcceptRecommendation(recommendation: ScheduleRecommendationType) {
    onApplyRecommendation(recommendation);
    onOpenChange(false);
  }

  function handleIgnoreRecommendation() {
    // Just close or switch to templates
    setActiveTab('templates');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Templates & AI Recommendations</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'ai')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Browse Templates</TabsTrigger>
            <TabsTrigger value="ai">AI Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-6">
            <TemplateGallery
              onSelectTemplate={handleSelectTemplate}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="ai" className="mt-6">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Our AI will analyze your room&apos;s sensor history, growth stage, and target conditions
                to recommend optimal device schedules tailored to your specific environment.
              </div>
              <ScheduleRecommendation
                roomId={roomId}
                controllerId={controllerId}
                growthStage={growthStage}
                targetConditions={targetConditions}
                onAccept={handleAcceptRecommendation}
                onIgnore={handleIgnoreRecommendation}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Trigger button component for opening the schedule templates dialog
 */
interface ScheduleTemplatesTriggerProps {
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function ScheduleTemplatesTrigger({
  onClick,
  variant = 'outline',
  size = 'default',
  className,
}: ScheduleTemplatesTriggerProps) {
  return (
    <Button variant={variant} size={size} onClick={onClick} className={className}>
      Browse Templates
    </Button>
  );
}
