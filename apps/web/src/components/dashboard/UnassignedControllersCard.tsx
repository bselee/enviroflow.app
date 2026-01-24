"use client";

import { Cpu, Wifi, WifiOff, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Controller } from "@/types";

interface UnassignedControllersCardProps {
  controllers: Controller[];
}

export function UnassignedControllersCard({ controllers }: UnassignedControllersCardProps) {
  if (controllers.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-amber-200 dark:border-amber-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold">Unassigned Controllers</h3>
        <Badge variant="secondary">{controllers.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        These controllers are not assigned to any room. Assign them to see their data on the dashboard.
      </p>
      <div className="space-y-2">
        {controllers.map((controller) => {
          const isOnline = controller.status === 'online';
          const StatusIcon = isOnline ? Wifi : WifiOff;

          return (
            <div
              key={controller.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <StatusIcon
                  className={`w-4 h-4 ${
                    isOnline ? 'text-green-500' : 'text-gray-400'
                  }`}
                />
                <div>
                  <p className="font-medium text-sm">{controller.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {controller.brand.toUpperCase()} • {controller.model || 'Unknown Model'}
                  </p>
                </div>
              </div>
              <Badge variant={isOnline ? 'default' : 'secondary'} className="text-xs">
                {controller.status}
              </Badge>
            </div>
          );
        })}
      </div>
      <Link href="/controllers">
        <Button variant="outline" className="w-full mt-4">
          Manage Controllers
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
