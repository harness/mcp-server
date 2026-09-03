import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough } from "../extractors.js";

// Development Harness (ADLC) — autonomous AI-driven software work.
// All routes are project-scoped under /adlc/api/* on the standard Harness
// gateway (no baseUrlOverride). Auth: X-Api-Key (PAT/SAT) + Harness-Account
// header, both injected by the harness-client. Scope params are
// orgIdentifier / projectIdentifier (ADLC convention), which the registry
// injects by default for project-scoped resources — no per-op remap needed.
// Verified live against https://qa0.harness.io on 2026-09-03.

// ── Body schemas ──────────────────────────────────────────────────────────
// ADLC's create/update bodies for work-config entities are YAML ask-bodies
// validated server-side against JSON Schema SSOTs in contracts/schemas/v1/.
// Agents pass the full YAML document; the server parses it. Modeled as a
// single `yaml` field per the BodyFieldSpec "yaml" type.

const workClassBodySchema: BodySchema = {
  description: "WorkClass YAML definition (ask-body). See contracts/schemas/v1/ in adlc-service for the JSON Schema.",
  fields: [
    { name: "yaml", type: "yaml", required: true, description: "Full WorkClass YAML document." },
  ],
};

const triggerBodySchema: BodySchema = {
  description: "Trigger YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full Trigger YAML document." }],
};

const capabilityBodySchema: BodySchema = {
  description: "Capability YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full Capability YAML document." }],
};

const riskEvaluatorBodySchema: BodySchema = {
  description: "RiskEvaluator YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full RiskEvaluator YAML document." }],
};

const teamBodySchema: BodySchema = {
  description: "Team YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full Team YAML document." }],
};

const memberBodySchema: BodySchema = {
  description: "Member YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full Member YAML document." }],
};

const memberTemplateBodySchema: BodySchema = {
  description: "MemberTemplate YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full MemberTemplate YAML document." }],
};

const softwareComponentBodySchema: BodySchema = {
  description: "SoftwareComponent YAML definition (ask-body).",
  fields: [{ name: "yaml", type: "yaml", required: true, description: "Full SoftwareComponent YAML document." }],
};

// ADLC list endpoints return { items: [...] } (verified for /workitems).
// passthrough returns the raw object; harness_list reads .items automatically.
const listResponseExtractor = passthrough;

// Execute actions that take an empty or minimal body still declare a bodySchema
// so harness_describe shows agents what (if anything) to pass, and the
// structural-validation test's risky-execute contract is satisfied.
const emptyBodySchema: BodySchema = {
  description: "No request body required.",
  fields: [],
};
const approveBodySchema: BodySchema = {
  description: "Gate approval decision.",
  fields: [
    { name: "decision", type: "string", required: true, description: "Approval decision, e.g. 'approve' or 'reject'." },
    { name: "reason", type: "string", required: false, description: "Optional reason for the decision." },
  ],
};

export const autonomousWorkToolset: ToolsetDefinition = {
  name: "autonomous_work",
  displayName: "Development Harness (Autonomous Work)",
  description:
    "Autonomous AI-driven software work — WorkItems progressing through a " +
    "plan→design→implement→review→merged lifecycle, with WorkClasses, budgets, " +
    "risk control, teams/members, triggers, and agent dispatch. All routes are " +
    "project-scoped under /adlc/api/*.",
  resources: [
    // ── WorkItem (the core entity) ────────────────────────────────────────
    {
      resourceType: "work_item",
      displayName: "Work Item",
      description:
        "An autonomous software work unit progressing through plan→design→implement→review→merged. " +
        "List/get only — work items are created via Slack or the agent-execution flow, not a public POST. " +
        "Pass org_id and project_id on every call.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id"],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/dh/orgs/{orgIdentifier}/projects/{projectIdentifier}/workitems/{workItemId}",
      relatedResources: [
        { resourceType: "work_timeline", relationship: "child", description: "Timeline rail for this work item" },
        { resourceType: "work_phase", relationship: "child", description: "Lifecycle phase detail" },
        { resourceType: "work_budget", relationship: "child", description: "Budgets applying to this work item" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/workitems",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: listResponseExtractor,
          description: "List work items in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/workitems/{workItemId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_item_id: "workItemId" },
          responseExtractor: passthrough,
          description: "Get a single work item by ID.",
        },
      },
    },

    // ── WorkItem lifecycle actions (resume / approve) ─────────────────────
    {
      resourceType: "work_item_resume",
      displayName: "Work Item Resume",
      description: "Resume a budget-blocked or gated work item.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id"],
      operations: {},
      executeActions: {
        run: {
          method: "POST",
          path: "/adlc/api/workitems/{workItemId}/resume",
          pathParams: { work_item_id: "workItemId" },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Resume a budget-blocked or gated work item.",
          bodySchema: emptyBodySchema,
        },
      },
    },
    {
      resourceType: "work_item_approve",
      displayName: "Work Item Approve",
      description: "Approve or reject a pending gate on a work item.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id"],
      operations: {},
      executeActions: {
        run: {
          method: "POST",
          path: "/adlc/api/workitems/{workItemId}/approve",
          pathParams: { work_item_id: "workItemId" },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          actionDescription: "Approve or reject a pending gate. Pass decision via params/body.",
          bodySchema: approveBodySchema,
        },
      },
    },

    // ── WorkItem sub-resources (read-only) ────────────────────────────────
    {
      resourceType: "work_timeline",
      displayName: "Work Timeline",
      description: "Timeline rail for a work item.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id"],
      operations: {
        get: {
          method: "GET",
          path: "/adlc/api/workitems/{workItemId}/timeline",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_item_id: "workItemId" },
          responseExtractor: passthrough,
          description: "Get the timeline rail for a work item.",
        },
      },
    },
    {
      resourceType: "work_budget",
      displayName: "Work Item Budgets",
      description: "Budgets that apply to a work item with current usage.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id"],
      operations: {
        get: {
          method: "GET",
          path: "/adlc/api/workitems/{workItemId}/budgets",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_item_id: "workItemId" },
          responseExtractor: passthrough,
          description: "Get budgets applying to a work item with this item's contribution vs allowance.",
        },
      },
    },
    {
      resourceType: "work_phase",
      displayName: "Work Phase",
      description: "Phase detail including participants for a work item phase.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id", "phase_id"],
      operations: {
        get: {
          method: "GET",
          path: "/adlc/api/workitems/{workItemId}/phases/{phaseId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_item_id: "workItemId", phase_id: "phaseId" },
          responseExtractor: passthrough,
          description: "Get phase detail including participants.",
        },
      },
    },
    {
      resourceType: "work_phase_artifact",
      displayName: "Work Phase Artifacts",
      description: "Artifact collection for a phase of a work item.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id", "phase_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/workitems/{workItemId}/phases/{phaseId}/artifacts",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_item_id: "workItemId", phase_id: "phaseId" },
          responseExtractor: passthrough,
          description: "List the current artifact collection for a phase.",
        },
      },
    },
    {
      resourceType: "work_artifact",
      displayName: "Work Artifact Content",
      description: "Resolved content of one artifact within a phase's collection.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_item_id", "phase_id", "artifact_id"],
      operations: {
        get: {
          method: "GET",
          path: "/adlc/api/workitems/{workItemId}/phases/{phaseId}/artifacts/{artifactId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_item_id: "workItemId", phase_id: "phaseId", artifact_id: "artifactId" },
          responseExtractor: passthrough,
          description: "Resolve one artifact's content within a phase's artifact collection.",
        },
      },
    },

    // ── Budgets ───────────────────────────────────────────────────────────
    {
      resourceType: "budget",
      displayName: "Budget",
      description: "A cost/approval budget for autonomous work. List/get only.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["budget_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/budgets",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "List budgets in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/budgets/{budgetId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { budget_id: "budgetId" },
          responseExtractor: passthrough,
          description: "Get a single budget by ID.",
        },
      },
    },
    {
      resourceType: "budget_grant",
      displayName: "Budget Grant",
      description: "Apply one approval increment to a budget.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["budget_id"],
      operations: {},
      executeActions: {
        run: {
          method: "POST",
          path: "/adlc/api/budgets/{budgetId}/grant",
          pathParams: { budget_id: "budgetId" },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Apply one approval increment to a budget.",
          bodySchema: emptyBodySchema,
        },
      },
    },
    {
      resourceType: "budget_usage",
      displayName: "Budget Usage",
      description: "Current-period usage for a budget.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["budget_id"],
      operations: {
        get: {
          method: "GET",
          path: "/adlc/api/budgets/{budgetId}/usage",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { budget_id: "budgetId" },
          responseExtractor: passthrough,
          description: "Get current-period usage for a budget.",
        },
      },
    },

    // ── WorkConfig CRUD (YAML ask-bodies) ─────────────────────────────────
    {
      resourceType: "work_class",
      displayName: "Work Class",
      description:
        "A WorkClass definition — the runtime model for a category of autonomous work. " +
        "Full CRUD; create/update take a YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["work_class_id"],
      listFilterFields: [{ name: "team_id", description: "Filter by team identifier" }],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/work-classes",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { team_id: "teamId", page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List work classes in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/work-classes/{workClassId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { work_class_id: "workClassId" },
          responseExtractor: passthrough,
          description: "Get a single work class by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/work-classes",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a work class. Pass the full WorkClass YAML as the body.",
          bodySchema: workClassBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/work-classes/{workClassId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { work_class_id: "workClassId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a work class. Pass the full WorkClass YAML as the body.",
          bodySchema: workClassBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/work-classes/{workClassId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { work_class_id: "workClassId" },
          responseExtractor: passthrough,
          description: "Delete a work class.",
        },
      },
    },
    {
      resourceType: "work_trigger",
      displayName: "Work Trigger",
      description: "A work trigger (manual / scheduled / webhook). Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["trigger_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/triggers",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List triggers in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/triggers/{triggerId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { trigger_id: "triggerId" },
          responseExtractor: passthrough,
          description: "Get a single trigger by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/triggers",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a trigger. Pass the full Trigger YAML as the body.",
          bodySchema: triggerBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/triggers/{triggerId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { trigger_id: "triggerId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a trigger. Pass the full Trigger YAML as the body.",
          bodySchema: triggerBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/triggers/{triggerId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { trigger_id: "triggerId" },
          responseExtractor: passthrough,
          description: "Delete a trigger.",
        },
      },
    },
    {
      resourceType: "capability",
      displayName: "Capability",
      description: "A capability grant for work classes. Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["capability_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/capabilities",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List capabilities in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/capabilities/{capabilityId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { capability_id: "capabilityId" },
          responseExtractor: passthrough,
          description: "Get a single capability by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/capabilities",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a capability. Pass the full Capability YAML as the body.",
          bodySchema: capabilityBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/capabilities/{capabilityId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { capability_id: "capabilityId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a capability. Pass the full Capability YAML as the body.",
          bodySchema: capabilityBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/capabilities/{capabilityId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { capability_id: "capabilityId" },
          responseExtractor: passthrough,
          description: "Delete a capability.",
        },
      },
    },
    {
      resourceType: "risk_evaluator",
      displayName: "Risk Evaluator",
      description: "A risk evaluator definition. Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["risk_evaluator_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/risk-evaluators",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List risk evaluators in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/risk-evaluators/{riskEvaluatorId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { risk_evaluator_id: "riskEvaluatorId" },
          responseExtractor: passthrough,
          description: "Get a single risk evaluator by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/risk-evaluators",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a risk evaluator. Pass the full RiskEvaluator YAML as the body.",
          bodySchema: riskEvaluatorBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/risk-evaluators/{riskEvaluatorId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { risk_evaluator_id: "riskEvaluatorId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a risk evaluator. Pass the full RiskEvaluator YAML as the body.",
          bodySchema: riskEvaluatorBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/risk-evaluators/{riskEvaluatorId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { risk_evaluator_id: "riskEvaluatorId" },
          responseExtractor: passthrough,
          description: "Delete a risk evaluator.",
        },
      },
    },

    // ── Members / teams / software components ─────────────────────────────
    {
      resourceType: "team",
      displayName: "Team",
      description: "A team configuration. Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["team_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/teams",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List teams in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/teams/{teamId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { team_id: "teamId" },
          responseExtractor: passthrough,
          description: "Get a single team by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/teams",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a team. Pass the full Team YAML as the body.",
          bodySchema: teamBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/teams/{teamId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { team_id: "teamId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a team. Pass the full Team YAML as the body.",
          bodySchema: teamBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/teams/{teamId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { team_id: "teamId" },
          responseExtractor: passthrough,
          description: "Delete a team.",
        },
      },
    },
    {
      resourceType: "member",
      displayName: "Member",
      description: "An AI team member. Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["member_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/members",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List members in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/members/{memberId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { member_id: "memberId" },
          responseExtractor: passthrough,
          description: "Get a single member by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/members",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a member. Pass the full Member YAML as the body.",
          bodySchema: memberBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/members/{memberId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { member_id: "memberId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a member. Pass the full Member YAML as the body.",
          bodySchema: memberBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/members/{memberId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { member_id: "memberId" },
          responseExtractor: passthrough,
          description: "Delete a member.",
        },
      },
    },
    {
      resourceType: "member_template",
      displayName: "Member Template",
      description: "A reusable member template. Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["member_template_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/member-templates",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List member templates in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/member-templates/{memberTemplateId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { member_template_id: "memberTemplateId" },
          responseExtractor: passthrough,
          description: "Get a single member template by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/member-templates",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a member template. Pass the full MemberTemplate YAML as the body.",
          bodySchema: memberTemplateBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/member-templates/{memberTemplateId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { member_template_id: "memberTemplateId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a member template. Pass the full MemberTemplate YAML as the body.",
          bodySchema: memberTemplateBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/member-templates/{memberTemplateId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { member_template_id: "memberTemplateId" },
          responseExtractor: passthrough,
          description: "Delete a member template.",
        },
      },
    },
    {
      resourceType: "software_component",
      displayName: "Software Component",
      description: "A software component a team owns. Full CRUD; YAML ask-body.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["software_component_id"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/software-components",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "offset", size: "limit" },
          responseExtractor: passthrough,
          description: "List software components in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/software-components/{softwareComponentId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { software_component_id: "softwareComponentId" },
          responseExtractor: passthrough,
          description: "Get a single software component by ID.",
        },
        create: {
          method: "POST",
          path: "/adlc/api/software-components",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a software component. Pass the full SoftwareComponent YAML as the body.",
          bodySchema: softwareComponentBodySchema,
        },
        update: {
          method: "PUT",
          path: "/adlc/api/software-components/{softwareComponentId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { software_component_id: "softwareComponentId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a software component. Pass the full SoftwareComponent YAML as the body.",
          bodySchema: softwareComponentBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/adlc/api/software-components/{softwareComponentId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { software_component_id: "softwareComponentId" },
          responseExtractor: passthrough,
          description: "Delete a software component.",
        },
      },
    },
    {
      resourceType: "content_source_connector",
      displayName: "Content Source Connector",
      description: "Default content-source connectors. List/get/update (PUT setDefaultConnectors).",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: ["source_type"],
      operations: {
        list: {
          method: "GET",
          path: "/adlc/api/content-source-connectors",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "List content-source connectors in a project.",
        },
        get: {
          method: "GET",
          path: "/adlc/api/content-source-connectors/{sourceType}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { source_type: "sourceType" },
          responseExtractor: passthrough,
          description: "Get a single content-source connector by source type.",
        },
      },
      executeActions: {
        set_default: {
          method: "PUT",
          path: "/adlc/api/content-source-connectors",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          actionDescription: "Set default content-source connectors (PUT setDefaultConnectors).",
          bodySchema: {
            description: "Default content-source connector mappings to set.",
            fields: [
              { name: "connectors", type: "object", required: true, description: "Mapping of source type to connector reference." },
            ],
          },
        },
      },
    },

    // ── Agent execution (the trigger) ─────────────────────────────────────
    {
      resourceType: "agent_execution",
      displayName: "Agent Execution",
      description:
        "Launch an autonomous agent pipeline execution. Takes org/project scope only (no body) — " +
        "the agent pipeline is configured server-side per WorkClass. Returns { executionId, status }.",
      toolset: "autonomous_work",
      scope: "project",
      identifierFields: [],
      operations: {},
      executeActions: {
        run: {
          method: "POST",
          path: "/adlc/api/agent/executions",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Launch an agent pipeline execution for autonomous work.",
          bodySchema: emptyBodySchema,
        },
      },
    },
  ],
};