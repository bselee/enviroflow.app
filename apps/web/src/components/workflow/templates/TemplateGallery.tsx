/**
 * TemplateGallery - Modal for browsing and applying workflow templates
 * 
 * Features:
 * - Browse built-in templates by category
 * - Search templates by name/description
 * - Preview template structure
 * - Device mapping wizard for applying templates
 */

"use client";

import * as React from "react";
import { 
  Thermometer, 
  Moon, 
  Flame, 
  Droplet, 
  Sunrise, 
  Wind,
  Search,
  Check,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BUILTIN_TEMPLATES,
  searchTemplates,
  getTemplateById,
  applyDeviceMapping,
  validateDeviceMapping,
  type WorkflowTemplate,
  type TemplateDeviceRequirement,
  type TemplateSensorRequirement,
} from "./builtin-templates";

// Icon mapping for templates
const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  thermometer: Thermometer,
  moon: Moon,
  flame: Flame,
  droplet: Droplet,
  sunrise: Sunrise,
  wind: Wind,
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  climate: "Climate Control",
  lighting: "Lighting",
  irrigation: "Irrigation",
  safety: "Safety",
  scheduling: "Scheduling",
};

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controllers: Array<{ 
    id: string; 
    name: string; 
    ports?: Array<{ port: number; deviceType?: string; name?: string }>;
  }>;
  onApplyTemplate: (nodes: unknown[], edges: unknown[], name: string) => void;
}

type WizardStep = "browse" | "preview" | "mapping";

interface DeviceMapping {
  [placeholderId: string]: {
    controllerId: string;
    port?: number;
    controllerName?: string;
  };
}

export function TemplateGallery({ 
  open, 
  onOpenChange, 
  controllers,
  onApplyTemplate,
}: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = React.useState<WorkflowTemplate | null>(null);
  const [wizardStep, setWizardStep] = React.useState<WizardStep>("browse");
  const [deviceMapping, setDeviceMapping] = React.useState<DeviceMapping>({});

  // Filter templates based on search and category
  const filteredTemplates = React.useMemo(() => {
    let templates = searchQuery 
      ? searchTemplates(searchQuery)
      : BUILTIN_TEMPLATES;
    
    if (selectedCategory !== "all") {
      templates = templates.filter(t => t.category === selectedCategory);
    }
    
    return templates;
  }, [searchQuery, selectedCategory]);

  // Auto-match devices based on type
  const autoMatchDevices = React.useCallback((template: WorkflowTemplate) => {
    const mapping: DeviceMapping = {};
    
    // Combine device and sensor requirements
    const allRequirements = [
      ...template.deviceRequirements.map(r => ({ ...r, isSensor: false })),
      ...template.sensorRequirements.map(r => ({ ...r, isSensor: true, deviceType: r.sensorType })),
    ];
    
    for (const req of allRequirements) {
      // Find a controller/port that matches the device type
      for (const controller of controllers) {
        if (controller.ports) {
          for (const port of controller.ports) {
            // Check if device type matches
            if (port.deviceType === req.deviceType) {
              // Check if this controller:port isn't already mapped
              const alreadyMapped = Object.values(mapping).some(
                m => m.controllerId === controller.id && m.port === port.port
              );
              
              if (!alreadyMapped) {
                mapping[req.placeholderId] = {
                  controllerId: controller.id,
                  port: port.port,
                  controllerName: controller.name,
                };
                break;
              }
            }
          }
        }
        
        if (mapping[req.placeholderId]) break;
      }
    }
    
    return mapping;
  }, [controllers]);

  // Handle template selection
  const handleSelectTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setWizardStep("preview");
  };

  // Handle proceeding to mapping
  const handleProceedToMapping = () => {
    if (selectedTemplate) {
      const autoMatched = autoMatchDevices(selectedTemplate);
      setDeviceMapping(autoMatched);
      setWizardStep("mapping");
    }
  };

  // Handle applying template
  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;
    
    const validation = validateDeviceMapping(selectedTemplate, deviceMapping);
    if (!validation.valid) {
      return; // Don't apply if mapping is incomplete
    }
    
    const { nodes, edges } = applyDeviceMapping(selectedTemplate, deviceMapping);
    onApplyTemplate(nodes, edges, selectedTemplate.name);
    
    // Reset state
    setSelectedTemplate(null);
    setWizardStep("browse");
    setDeviceMapping({});
    onOpenChange(false);
  };

  // Handle going back
  const handleBack = () => {
    if (wizardStep === "mapping") {
      setWizardStep("preview");
    } else if (wizardStep === "preview") {
      setSelectedTemplate(null);
      setWizardStep("browse");
    }
  };

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setSelectedTemplate(null);
      setWizardStep("browse");
      setDeviceMapping({});
      setSearchQuery("");
    }
  }, [open]);

  // Check if mapping is complete
  const mappingValidation = selectedTemplate 
    ? validateDeviceMapping(selectedTemplate, deviceMapping)
    : { valid: false, missingDevices: [] };

  const matchedCount = selectedTemplate 
    ? (selectedTemplate.deviceRequirements.length + selectedTemplate.sensorRequirements.length) - mappingValidation.missingDevices.length
    : 0;
  
  const totalRequirements = selectedTemplate 
    ? selectedTemplate.deviceRequirements.length + selectedTemplate.sensorRequirements.length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {wizardStep !== "browse" && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle>
                {wizardStep === "browse" && "Template Gallery"}
                {wizardStep === "preview" && selectedTemplate?.name}
                {wizardStep === "mapping" && "Map Your Devices"}
              </DialogTitle>
              <DialogDescription>
                {wizardStep === "browse" && "Choose a template to get started quickly"}
                {wizardStep === "preview" && selectedTemplate?.description}
                {wizardStep === "mapping" && `${matchedCount} of ${totalRequirements} devices auto-matched`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Browse Step */}
        {wizardStep === "browse" && (
          <>
            {/* Search and Filter */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="climate">Climate Control</SelectItem>
                  <SelectItem value="lighting">Lighting</SelectItem>
                  <SelectItem value="irrigation">Irrigation</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="scheduling">Scheduling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template Grid */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="grid grid-cols-2 gap-4 pb-4">
                {filteredTemplates.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.icon] || Thermometer;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                        "hover:bg-muted/50 hover:border-primary/50",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      )}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORY_LABELS[template.category]}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {filteredTemplates.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No templates found matching your search.
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* Preview Step */}
        {wizardStep === "preview" && selectedTemplate && (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 pb-4">
                {/* Template Info */}
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-3">
                    {(() => {
                      const Icon = TEMPLATE_ICONS[selectedTemplate.icon] || Thermometer;
                      return (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                      );
                    })()}
                    <div>
                      <p className="font-semibold text-lg">{selectedTemplate.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {CATEGORY_LABELS[selectedTemplate.category]}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedTemplate.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Device Requirements */}
                <div>
                  <h4 className="font-medium mb-2">Required Devices</h4>
                  <div className="space-y-2">
                    {selectedTemplate.deviceRequirements.map((req) => (
                      <div
                        key={req.placeholderId}
                        className="flex items-center gap-2 rounded-md border p-3"
                      >
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        <span className="text-sm">{req.label}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {req.deviceType}
                        </Badge>
                      </div>
                    ))}
                    {selectedTemplate.sensorRequirements.map((req) => (
                      <div
                        key={req.placeholderId}
                        className="flex items-center gap-2 rounded-md border p-3"
                      >
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-sm">{req.label}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {req.sensorType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow Structure Preview */}
                <div>
                  <h4 className="font-medium mb-2">Workflow Structure</h4>
                  <div className="rounded-md border p-4 bg-muted/20">
                    <div className="text-sm text-muted-foreground mb-2">
                      {selectedTemplate.nodes.length} nodes • {selectedTemplate.edges.length} connections
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.nodes.map((node) => (
                        <Badge
                          key={node.id}
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            node.type === "trigger" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            node.type === "action" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                            node.type === "delay" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                            node.type === "debounce" && "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
                            node.type === "notification" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          )}
                        >
                          {node.data.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleProceedToMapping}>
                Map Devices
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Mapping Step */}
        {wizardStep === "mapping" && selectedTemplate && (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-4">
                {/* Status Banner */}
                {mappingValidation.valid ? (
                  <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      All devices mapped! Ready to create workflow.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-400">
                      {mappingValidation.missingDevices.length} device(s) need manual selection: {mappingValidation.missingDevices.join(", ")}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Device Mapping Table */}
                <div className="space-y-3">
                  {/* Device Requirements */}
                  {selectedTemplate.deviceRequirements.map((req) => (
                    <DeviceMappingRow
                      key={req.placeholderId}
                      requirement={req}
                      controllers={controllers}
                      currentMapping={deviceMapping[req.placeholderId]}
                      onMappingChange={(mapping) => {
                        setDeviceMapping(prev => ({
                          ...prev,
                          [req.placeholderId]: mapping,
                        }));
                      }}
                    />
                  ))}
                  
                  {/* Sensor Requirements */}
                  {selectedTemplate.sensorRequirements.map((req) => (
                    <SensorMappingRow
                      key={req.placeholderId}
                      requirement={req}
                      controllers={controllers}
                      currentMapping={deviceMapping[req.placeholderId]}
                      onMappingChange={(mapping) => {
                        setDeviceMapping(prev => ({
                          ...prev,
                          [req.placeholderId]: mapping,
                        }));
                      }}
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button 
                onClick={handleApplyTemplate}
                disabled={!mappingValidation.valid}
              >
                <Check className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Device Mapping Row Component
function DeviceMappingRow({
  requirement,
  controllers,
  currentMapping,
  onMappingChange,
}: {
  requirement: TemplateDeviceRequirement;
  controllers: TemplateGalleryProps["controllers"];
  currentMapping?: DeviceMapping[string];
  onMappingChange: (mapping: DeviceMapping[string]) => void;
}) {
  const isMatched = Boolean(currentMapping?.controllerId);
  
  // Build options from controllers and their ports
  const options = React.useMemo(() => {
    const opts: Array<{ value: string; label: string; controllerId: string; port?: number }> = [];
    
    for (const controller of controllers) {
      if (controller.ports) {
        for (const port of controller.ports) {
          // Filter by device type if available
          if (!port.deviceType || port.deviceType === requirement.deviceType) {
            opts.push({
              value: `${controller.id}:${port.port}`,
              label: `${controller.name} - Port ${port.port}${port.name ? ` (${port.name})` : ""}`,
              controllerId: controller.id,
              port: port.port,
            });
          }
        }
      } else {
        // Controller without ports
        opts.push({
          value: controller.id,
          label: controller.name,
          controllerId: controller.id,
        });
      }
    }
    
    return opts;
  }, [controllers, requirement.deviceType]);

  const currentValue = currentMapping 
    ? currentMapping.port !== undefined 
      ? `${currentMapping.controllerId}:${currentMapping.port}`
      : currentMapping.controllerId
    : "";

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full",
        isMatched ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
      )}>
        {isMatched ? (
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{requirement.label}</p>
        <p className="text-xs text-muted-foreground capitalize">{requirement.deviceType}</p>
      </div>
      
      <Select
        value={currentValue}
        onValueChange={(value) => {
          const option = options.find(o => o.value === value);
          if (option) {
            onMappingChange({
              controllerId: option.controllerId,
              port: option.port,
              controllerName: controllers.find(c => c.id === option.controllerId)?.name,
            });
          }
        }}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select device..." />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="none" disabled>
              No compatible devices
            </SelectItem>
          ) : (
            options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// Sensor Mapping Row Component
function SensorMappingRow({
  requirement,
  controllers,
  currentMapping,
  onMappingChange,
}: {
  requirement: TemplateSensorRequirement;
  controllers: TemplateGalleryProps["controllers"];
  currentMapping?: DeviceMapping[string];
  onMappingChange: (mapping: DeviceMapping[string]) => void;
}) {
  const isMatched = Boolean(currentMapping?.controllerId);
  
  // For sensors, we just need a controller that has the sensor type
  const options = React.useMemo(() => {
    return controllers.map(c => ({
      value: c.id,
      label: c.name,
      controllerId: c.id,
    }));
  }, [controllers]);

  const currentValue = currentMapping?.controllerId || "";

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 border-blue-200 dark:border-blue-800">
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full",
        isMatched ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
      )}>
        {isMatched ? (
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{requirement.label}</p>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            sensor
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">{requirement.sensorType}</span>
        </div>
      </div>
      
      <Select
        value={currentValue}
        onValueChange={(value) => {
          const controller = controllers.find(c => c.id === value);
          if (controller) {
            onMappingChange({
              controllerId: controller.id,
              controllerName: controller.name,
            });
          }
        }}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select controller..." />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="none" disabled>
              No controllers available
            </SelectItem>
          ) : (
            options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export default TemplateGallery;
