/**
 * Workflow Validation Utilities
 *
 * Validates that workflows reference valid, available controllers, sensors, and devices.
 */

import type {
  WorkflowNode,
  SensorNodeData,
  ActionNodeData,
} from "@/components/workflow/types";
import type { ControllerCapabilities } from "@/hooks/use-controller-capabilities";

export interface ValidationIssue {
  nodeId: string;
  nodeLabel: string;
  severity: 'error' | 'warning';
  message: string;
  type: 'controller_not_found' | 'controller_offline' | 'sensor_not_available' | 'device_not_available';
}

export interface WorkflowValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  canExecute: boolean; // false if there are errors that prevent execution
}

/**
 * Validate a workflow against current controller capabilities
 */
export function validateWorkflow(
  nodes: WorkflowNode[],
  capabilities: Map<string, ControllerCapabilities>
): WorkflowValidationResult {
  const issues: ValidationIssue[] = [];

  for (const node of nodes) {
    // Validate sensor nodes
    if (node.type === 'sensor') {
      const data = node.data as SensorNodeData;
      const controllerId = data.config.controllerId;

      if (!controllerId) {
        issues.push({
          nodeId: node.id,
          nodeLabel: data.label || 'Sensor',
          severity: 'error',
          message: 'No controller selected',
          type: 'controller_not_found',
        });
        continue;
      }

      const caps = capabilities.get(controllerId);

      if (!caps) {
        issues.push({
          nodeId: node.id,
          nodeLabel: data.label || 'Sensor',
          severity: 'error',
          message: `Controller "${data.config.controllerName || controllerId}" not found`,
          type: 'controller_not_found',
        });
        continue;
      }

      if (caps.status === 'offline') {
        issues.push({
          nodeId: node.id,
          nodeLabel: data.label || 'Sensor',
          severity: 'warning',
          message: `Controller "${caps.controller_name}" is offline`,
          type: 'controller_offline',
        });
      }

      // Check if sensor exists
      const sensorType = data.config.sensorType;
      const port = data.config.port;

      if (sensorType) {
        const sensorExists = caps.sensors.some(
          (s) => s.type === sensorType && (port === undefined || s.port === port)
        );

        if (!sensorExists) {
          issues.push({
            nodeId: node.id,
            nodeLabel: data.label || 'Sensor',
            severity: 'error',
            message: `Sensor "${sensorType}" not available on controller`,
            type: 'sensor_not_available',
          });
        }
      }
    }

    // Validate action nodes
    if (node.type === 'action') {
      const data = node.data as ActionNodeData;
      const controllerId = data.config.controllerId;

      if (!controllerId) {
        issues.push({
          nodeId: node.id,
          nodeLabel: data.label || 'Action',
          severity: 'error',
          message: 'No controller selected',
          type: 'controller_not_found',
        });
        continue;
      }

      const caps = capabilities.get(controllerId);

      if (!caps) {
        issues.push({
          nodeId: node.id,
          nodeLabel: data.label || 'Action',
          severity: 'error',
          message: `Controller "${data.config.controllerName || controllerId}" not found`,
          type: 'controller_not_found',
        });
        continue;
      }

      if (caps.status === 'offline') {
        issues.push({
          nodeId: node.id,
          nodeLabel: data.label || 'Action',
          severity: 'warning',
          message: `Controller "${caps.controller_name}" is offline`,
          type: 'controller_offline',
        });
      }

      // Check if device/port exists
      const port = data.config.port;

      if (port !== undefined) {
        const deviceExists = caps.devices.some((d) => d.port === port);

        if (!deviceExists) {
          issues.push({
            nodeId: node.id,
            nodeLabel: data.label || 'Action',
            severity: 'error',
            message: `Device on port ${port} not available on controller`,
            type: 'device_not_available',
          });
        } else {
          // Check if device is online
          const device = caps.devices.find((d) => d.port === port);
          if (device && !device.isOnline) {
            issues.push({
              nodeId: node.id,
              nodeLabel: data.label || 'Action',
              severity: 'warning',
              message: `Device on port ${port} is offline`,
              type: 'device_not_available',
            });
          }
        }
      }
    }
  }

  // Determine if workflow can execute
  const hasErrors = issues.some((issue) => issue.severity === 'error');

  return {
    isValid: issues.length === 0,
    issues,
    canExecute: !hasErrors,
  };
}

/**
 * Format validation issues for display
 */
export function formatValidationSummary(result: WorkflowValidationResult): string {
  if (result.isValid) {
    return 'Workflow is valid and ready to execute.';
  }

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');

  const parts: string[] = [];

  if (errors.length > 0) {
    parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''}`);
  }

  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
  }

  const summary = parts.join(', ');

  if (!result.canExecute) {
    return `Workflow cannot execute: ${summary}`;
  }

  return `Workflow has ${summary} but can still execute`;
}
