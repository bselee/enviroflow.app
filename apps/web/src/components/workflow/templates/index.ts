/**
 * Workflow Templates Module
 * 
 * Provides pre-built workflow templates for common automation scenarios.
 */

export {
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  getTemplatesByTag,
  searchTemplates,
  getTemplateById,
  applyDeviceMapping,
  validateDeviceMapping,
  type WorkflowTemplate,
  type TemplateDeviceRequirement,
  type TemplateSensorRequirement,
  type TemplateCategory,
} from "./builtin-templates";

export { TemplateGallery } from "./TemplateGallery";
