import type { ToolsetDefinition } from "../types.js";

/**
 * Local-only visualization resource types.
 * These have no API operations — they exist purely as metadata for harness_describe
 * so the LLM can discover what visual chart types are available and how to use them.
 */
export const visualizationsToolset: ToolsetDefinition = {
  name: "visualizations",
  displayName: "Visualizations",
  description: "Inline PNG chart visualizations rendered from Harness data. Use include_visual=true on supported tools.",
  resources: [
    {
      resourceType: "visual_timeline",
      displayName: "Pipeline Timeline (Gantt)",
      description: "Horizontal Gantt chart showing pipeline stage execution over time. Color-coded by status (green=success, red=failed, blue=running). Shows duration per stage and bottleneck identification.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_diagnose with options: { include_visual: true, visual_type: 'timeline' }",
        "Requires: an execution_id or pipeline_id (uses latest execution).",
        "Also supports visual_width (number, default 800) for wider charts.",
        "The response includes both JSON diagnosis data and an inline PNG image.",
      ].join("\n"),
    },
    {
      resourceType: "visual_stage_flow",
      displayName: "Pipeline Stage Flow (DAG)",
      description: "Left-to-right flowchart showing pipeline stages as connected nodes with arrows. Status-colored borders, step count labels. Good for understanding pipeline structure.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_diagnose with options: { include_visual: true, visual_type: 'flow' }",
        "Requires: an execution_id or pipeline_id.",
        "Also supports visual_width (number, default 800).",
      ].join("\n"),
    },
    {
      resourceType: "visual_health_dashboard",
      displayName: "Project Health Dashboard",
      description: "Project health overview with health badge (healthy/degraded/failing), metric cards (failed, running, recent counts), and recent execution status bar.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_status with include_visual: true",
        "Optionally pass org_id and project_id to scope the dashboard.",
        "The response includes both JSON health data and an inline PNG image.",
      ].join("\n"),
    },
    {
      resourceType: "visual_pie_chart",
      displayName: "Pie / Donut Chart",
      description: "Donut chart showing execution breakdown by status (Success, Failed, Expired, etc.) with percentages. Includes auto-generated analysis with key insights.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_list with resource_type='execution', include_visual: true, visual_type: 'pie'",
        "The chart aggregates list results by execution status.",
        "The response includes JSON data with an 'analysis' field and an inline PNG donut chart.",
      ].join("\n"),
    },
    {
      resourceType: "visual_bar_chart",
      displayName: "Bar Chart (by Pipeline)",
      description: "Horizontal bar chart showing execution counts grouped by pipeline name. Useful for comparing activity across pipelines.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_list with resource_type='execution', include_visual: true, visual_type: 'bar'",
        "The chart aggregates list results by pipeline identifier.",
        "The response includes JSON data with an 'analysis' field and an inline PNG bar chart.",
      ].join("\n"),
    },
    {
      resourceType: "visual_timeseries",
      displayName: "Execution Timeseries",
      description: "Stacked bar chart showing daily execution counts over the last 30 days, broken down by status (Success/Failed/Expired/Running). Good for spotting trends.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_list with resource_type='execution', include_visual: true, visual_type: 'timeseries'",
        "Aggregates executions by day from startTs timestamps.",
        "For best results, set size=100 to get more data points.",
        "The response includes JSON data and an inline PNG stacked bar chart.",
      ].join("\n"),
    },
    {
      resourceType: "visual_architecture",
      displayName: "Pipeline Architecture Diagram",
      description: "Multi-level architecture diagram showing the full pipeline hierarchy: stages → step groups → steps, with deployment strategy, service/environment refs, rollback paths, and failure handling. Parsed from pipeline YAML.",
      toolset: "visualizations",
      scope: "project",
      identifierFields: [],
      operations: {},
      diagnosticHint: [
        "To render: call harness_diagnose with options: { include_visual: true, visual_type: 'architecture', pipeline_id: '<id>', include_yaml: true }",
        "The include_yaml: true option fetches the pipeline YAML which is parsed into the diagram.",
        "Shows: Pipeline → Stages (with type badge: CI/Deployment/Approval) → Step Groups → Steps (with type + timeout).",
        "For Deployment stages: shows strategy (Canary/Rolling/BlueGreen), service ref, environment ref, infrastructure type.",
        "Rollback steps are shown in a separate red-highlighted section.",
        "The response includes both JSON diagnosis data and an inline PNG architecture diagram.",
      ].join("\n"),
    },
  ],
};
