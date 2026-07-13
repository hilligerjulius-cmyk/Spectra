import type { TemplateContext } from "../../pipeline/types";
import { todoTemplate } from "./templates/todo";
import { kanbanTemplate } from "./templates/kanban";
import { calculatorTemplate } from "./templates/calculator";
import { dashboardTemplate } from "./templates/dashboard";
import { timerTemplate } from "./templates/timer";
import { notesTemplate } from "./templates/notes";
import { formTemplate } from "./templates/form";
import { pricingTemplate } from "./templates/pricing";
import { landingTemplate } from "./templates/landing";

export type Template = (ctx: TemplateContext) => string;

/** archetype id → template. `landing` is the guaranteed-valid default. */
export const REGISTRY: Record<string, Template> = {
  todo: todoTemplate,
  kanban: kanbanTemplate,
  calculator: calculatorTemplate,
  dashboard: dashboardTemplate,
  timer: timerTemplate,
  notes: notesTemplate,
  form: formTemplate,
  pricing: pricingTemplate,
  landing: landingTemplate,
};

export const ARCHETYPES = Object.keys(REGISTRY);

/** Resolve a template for an archetype, falling back to the landing generator. */
export function resolveTemplate(archetype: string): Template {
  return REGISTRY[archetype] ?? landingTemplate;
}
