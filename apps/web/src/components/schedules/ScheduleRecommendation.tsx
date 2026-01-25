"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ScheduleRecommendation as ScheduleRecommendationType } from '@/types/schedules';

interface ScheduleRecommendationProps {
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
  onAccept: (recommendation: ScheduleRecommendationType) => void;
  onIgnore: () => void;
}

export function ScheduleRecommendation({
  roomId,
  controllerId,
  growthStage,
  targetConditions,
  onAccept,
  onIgnore,
}: ScheduleRecommendationProps) {
  const [recommendation, setRecommendation] = useState<ScheduleRecommendationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecommendation() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/schedules/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          controllerId,
          growthStage,
          targetConditions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get recommendation');
      }

      const data = await response.json();

      if (data.success) {
        setRecommendation({
          recommendation: data.recommendation,
          rationale: data.rationale,
          confidence: data.confidence,
          suggestedSchedules: data.suggestedSchedules,
          basedOn: data.basedOn,
        });
      } else {
        throw new Error('Failed to generate recommendation');
      }
    } catch (err) {
      console.error('Error fetching recommendation:', err);
      setError(err instanceof Error ? err.message : 'Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (recommendation) {
      onAccept(recommendation);
    }
  }

  if (!recommendation && !loading && !error) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Get AI Schedule Recommendations</CardTitle>
          <CardDescription>
            Let AI analyze your environment and suggest optimal device schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchRecommendation} className="w-full">
            Generate Smart Recommendations
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground">Analyzing your environment...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" onClick={fetchRecommendation} className="ml-4">
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!recommendation) {
    return null;
  }

  const confidenceColor =
    recommendation.confidence >= 80
      ? 'text-green-500'
      : recommendation.confidence >= 60
      ? 'text-yellow-500'
      : 'text-orange-500';

  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">AI Schedule Recommendation</CardTitle>
            <CardDescription>Based on your environmental data</CardDescription>
          </div>
          <Badge variant="secondary" className={confidenceColor}>
            {recommendation.confidence}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recommendation */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Recommendation</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {recommendation.recommendation}
          </p>
        </div>

        {/* Rationale */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Why This Schedule?</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {recommendation.rationale}
          </p>
        </div>

        {/* Suggested Schedules */}
        {recommendation.suggestedSchedules.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">
              Suggested Schedules ({recommendation.suggestedSchedules.length})
            </h4>
            <div className="space-y-2">
              {recommendation.suggestedSchedules.map((schedule, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border bg-muted/50 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{schedule.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {schedule.device_type}
                    </Badge>
                  </div>
                  {schedule.description && (
                    <p className="text-xs text-muted-foreground">{schedule.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {schedule.schedule.start_time && (
                      <span>Time: {schedule.schedule.start_time}</span>
                    )}
                    {schedule.schedule.action && (
                      <span className="ml-2">
                        Action: {schedule.schedule.action}
                        {schedule.schedule.level !== undefined && ` (${schedule.schedule.level}%)`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Based On */}
        {recommendation.basedOn && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Analysis Based On</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              {recommendation.basedOn.sensorHistory && (
                <div>
                  Sensor History:
                  {Object.entries(recommendation.basedOn.sensorHistory).map(([key, value]) => (
                    <span key={key} className="ml-2">
                      {key}: {typeof value === 'object' && value !== null
                        ? `${(value as { avg?: number }).avg}${(value as { unit?: string }).unit}`
                        : String(value)}
                    </span>
                  ))}
                </div>
              )}
              {recommendation.basedOn.growthStage && (
                <div>Growth Stage: {recommendation.basedOn.growthStage}</div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleAccept} className="flex-1">
            Accept & Apply Schedules
          </Button>
          <Button variant="outline" onClick={onIgnore}>
            Ignore
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchRecommendation}>
            Regenerate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
