/**
 * Tests for the workflow template system.
 */

import {
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  getTemplatesByTag,
  searchTemplates,
  getTemplateById,
  applyDeviceMapping,
  validateDeviceMapping,
  type WorkflowTemplate,
} from "../builtin-templates";

describe("Workflow Templates", () => {
  describe("BUILTIN_TEMPLATES", () => {
    it("should have at least 5 built-in templates", () => {
      expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it("should have valid structure for all templates", () => {
      BUILTIN_TEMPLATES.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(TEMPLATE_CATEGORIES.map(c => c.id)).toContain(template.category);
        expect(Array.isArray(template.tags)).toBe(true);
        expect(Array.isArray(template.nodes)).toBe(true);
        expect(Array.isArray(template.edges)).toBe(true);
        expect(template.nodes.length).toBeGreaterThan(0);
      });
    });

    it("should have unique template IDs", () => {
      const ids = BUILTIN_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe("TEMPLATE_CATEGORIES", () => {
    it("should have all expected categories", () => {
      const categoryIds = TEMPLATE_CATEGORIES.map((c) => c.id);
      expect(categoryIds).toContain("climate");
      expect(categoryIds).toContain("lighting");
      expect(categoryIds).toContain("safety");
      expect(categoryIds).toContain("scheduling");
    });

    it("should have labels for all categories", () => {
      TEMPLATE_CATEGORIES.forEach((cat) => {
        expect(cat.label).toBeTruthy();
      });
    });
  });

  describe("getTemplatesByCategory", () => {
    it("should return templates for climate category", () => {
      const climateTemplates = getTemplatesByCategory("climate");
      expect(climateTemplates.length).toBeGreaterThan(0);
      climateTemplates.forEach((t) => {
        expect(t.category).toBe("climate");
      });
    });

    it("should return templates for lighting category", () => {
      const lightingTemplates = getTemplatesByCategory("lighting");
      expect(lightingTemplates.length).toBeGreaterThan(0);
      lightingTemplates.forEach((t) => {
        expect(t.category).toBe("lighting");
      });
    });

    it("should return empty array for non-existent category", () => {
      const result = getTemplatesByCategory("nonexistent" as any);
      expect(result).toEqual([]);
    });
  });

  describe("getTemplatesByTag", () => {
    it("should return templates with vpd tag", () => {
      const vpdTemplates = getTemplatesByTag("vpd");
      expect(vpdTemplates.length).toBeGreaterThan(0);
      vpdTemplates.forEach((t) => {
        expect(t.tags).toContain("vpd");
      });
    });

    it("should be case-insensitive", () => {
      const lower = getTemplatesByTag("fan");
      const upper = getTemplatesByTag("FAN");
      expect(lower.length).toBe(upper.length);
    });
  });

  describe("searchTemplates", () => {
    it("should find templates by name", () => {
      const results = searchTemplates("VPD");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.toLowerCase()).toContain("vpd");
    });

    it("should find templates by description", () => {
      const results = searchTemplates("exhaust");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty array for no matches", () => {
      const results = searchTemplates("xyznonexistent123");
      expect(results).toEqual([]);
    });

    it("should be case-insensitive", () => {
      const lower = searchTemplates("humidity");
      const upper = searchTemplates("HUMIDITY");
      expect(lower.length).toBe(upper.length);
    });
  });

  describe("getTemplateById", () => {
    it("should return template for valid ID", () => {
      const template = getTemplateById("vpd-control");
      expect(template).toBeDefined();
      expect(template?.id).toBe("vpd-control");
    });

    it("should return undefined for invalid ID", () => {
      const template = getTemplateById("nonexistent");
      expect(template).toBeUndefined();
    });
  });

  describe("applyDeviceMapping", () => {
    let template: WorkflowTemplate;

    beforeEach(() => {
      template = getTemplateById("vpd-control")!;
    });

    it("should replace placeholder IDs with mapped controllers", () => {
      const mapping = {
        exhaust_fan: {
          controllerId: "controller-abc",
          port: 1,
          controllerName: "Main Controller",
        },
        vpd_sensor: {
          controllerId: "controller-def",
          controllerName: "Sensor Hub",
        },
      };

      const result = applyDeviceMapping(template, mapping);
      
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.nodes.length).toBe(template.nodes.length);
      expect(result.edges.length).toBe(template.edges.length);
      
      // Verify placeholders were actually replaced with mapped values
      const triggerNode = result.nodes.find(n => n.id === "trigger-1");
      expect(triggerNode?.data?.config?.controllerId).toBe("controller-def");
      
      const actionNode = result.nodes.find(n => n.id === "action-high");
      expect(actionNode?.data?.config?.controllerId).toBe("controller-abc");
      expect(actionNode?.data?.config?.port).toBe(1);
      expect(actionNode?.data?.config?.controllerName).toBe("Main Controller");
    });

    it("should not modify original template", () => {
      const originalNodes = JSON.stringify(template.nodes);
      
      const mapping = {
        exhaust_fan: {
          controllerId: "test-controller",
        },
      };

      applyDeviceMapping(template, mapping);
      
      expect(JSON.stringify(template.nodes)).toBe(originalNodes);
    });

    it("should preserve edges", () => {
      const result = applyDeviceMapping(template, {});
      
      expect(result.edges).toEqual(template.edges);
    });
  });

  describe("validateDeviceMapping", () => {
    let template: WorkflowTemplate;

    beforeEach(() => {
      template = getTemplateById("vpd-control")!;
    });

    it("should return valid when all requirements mapped", () => {
      // Get all required placeholders
      const mapping: Record<string, { controllerId: string }> = {};
      template.deviceRequirements.forEach((req) => {
        mapping[req.placeholderId] = { controllerId: "test" };
      });
      template.sensorRequirements.forEach((req) => {
        mapping[req.placeholderId] = { controllerId: "test" };
      });

      const result = validateDeviceMapping(template, mapping);
      
      expect(result.valid).toBe(true);
      expect(result.missingDevices).toHaveLength(0);
    });

    it("should return invalid with missing devices listed", () => {
      const result = validateDeviceMapping(template, {});
      
      expect(result.valid).toBe(false);
      expect(result.missingDevices.length).toBeGreaterThan(0);
    });

    it("should list all missing device labels", () => {
      const result = validateDeviceMapping(template, {});
      
      const expectedMissing = [
        ...template.deviceRequirements.map((r) => r.label),
        ...template.sensorRequirements.map((r) => r.label),
      ];
      
      expectedMissing.forEach((label) => {
        expect(result.missingDevices).toContain(label);
      });
    });

    it("should handle partial mappings", () => {
      const partialMapping = {
        [template.deviceRequirements[0]?.placeholderId]: { controllerId: "test" },
      };

      const result = validateDeviceMapping(template, partialMapping);
      
      expect(result.valid).toBe(false);
      expect(result.missingDevices.length).toBeLessThan(
        template.deviceRequirements.length + template.sensorRequirements.length
      );
    });
  });

  describe("Template Content Validation", () => {
    it("VPD Control template should have trigger and action nodes", () => {
      const template = getTemplateById("vpd-control")!;
      const nodeTypes = template.nodes.map((n) => n.type);
      
      expect(nodeTypes).toContain("trigger");
      expect(nodeTypes).toContain("action");
    });

    it("Heat Spike Response should have debounce node", () => {
      const template = getTemplateById("heat-spike-response")!;
      const nodeTypes = template.nodes.map((n) => n.type);
      
      expect(nodeTypes).toContain("debounce");
    });

    it("Lights Out Routine should have delay nodes", () => {
      const template = getTemplateById("lights-out-routine")!;
      const nodeTypes = template.nodes.map((n) => n.type);
      
      expect(nodeTypes).toContain("delay");
    });

    it("All templates should have connected edges", () => {
      BUILTIN_TEMPLATES.forEach((template) => {
        const nodeIds = new Set(template.nodes.map((n) => n.id));
        
        template.edges.forEach((edge) => {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        });
      });
    });
  });
});
