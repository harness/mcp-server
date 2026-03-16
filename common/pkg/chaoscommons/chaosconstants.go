package chaoscommons

const (
	// Tool Names
	ToolExperimentsList              = "chaos_experiments_list"
	ToolExperimentDescribe           = "chaos_experiment_describe"
	ToolExperimentRunResult          = "chaos_experiment_run_result"
	ToolExperimentRun                = "chaos_experiment_run"
	ToolStopExperiment               = "chaos_stop_experiment"
	ToolProbesList                   = "chaos_probes_list"
	ToolProbeDescribe                = "chaos_probe_describe"
	ToolGetProbeManifest             = "chaos_get_probe_manifest"
	ToolEnableProbe                  = "chaos_enable_probe"
	ToolDeleteProbe                  = "chaos_delete_probe"
	ToolVerifyProbe                  = "chaos_verify_probe"
	ToolListProbesInExperimentRun    = "chaos_list_probes_in_experiment_run"
	ToolListFaults                   = "chaos_list_faults"
	ToolGetFaultVariables            = "chaos_get_fault_variables"
	ToolGetFault                     = "chaos_get_fault"
	ToolGetFaultYaml                 = "chaos_get_fault_yaml"
	ToolListFaultExperimentRuns      = "chaos_list_fault_experiment_runs"
	ToolDeleteFault                  = "chaos_delete_fault"
	ToolCreateExperimentFromTemplate = "chaos_create_experiment_from_template"
	ToolExperimentTemplateList       = "chaos_experiment_template_list"
	ToolExperimentVariablesList      = "chaos_experiment_variables_list"
	ToolListLinuxInfrastructures     = "chaos_list_linux_infrastructures"
	ToolListActions                  = "chaos_list_actions"
	ToolGetAction                    = "chaos_get_action"
	ToolGetActionManifest            = "chaos_get_action_manifest"
	ToolDeleteAction                 = "chaos_delete_action"

	// Parameter Names
	ParamExperimentID        = "experimentID"
	ParamExperimentRunID     = "experimentRunID"
	ParamNotifyId            = "notifyId"
	ParamForce               = "force"
	ParamProbeId             = "probeId"
	ParamIsEnabled           = "isEnabled"
	ParamIsBulkUpdate        = "isBulkUpdate"
	ParamVerify              = "verify"
	ParamExperimentRunIds    = "experimentRunIds"
	ParamNotifyIds           = "notifyIds"
	ParamIdentity            = "identity"
	ParamIsEnterprise        = "isEnterprise"
	ParamTemplateId          = "templateId"
	ParamInfraId             = "infraId"
	ParamEnvironmentId       = "environmentId"
	ParamHubIdentity         = "hubIdentity"
	ParamName                = "name"
	ParamInputsetIdentity    = "inputsetIdentity"
	ParamExperimentVariables = "experimentVariables"
	ParamTasks               = "tasks"
	ParamInfrastructureType  = "infrastructureType"
	ParamSearch              = "search"
	ParamInfraType           = "infraType"
	ParamEntityType          = "entityType"
	ParamIncludeAllScope     = "includeAllScope"
	ParamStatus              = "status"

	// Tool Descriptions
	DescToolExperimentsList = `List the chaos experiments.
Returns a paginated list of experiments with experimentID, name, description, infra details (identity, environmentId), timestamps, and workflow type.`

	DescToolExperimentDescribe = `Retrieves detailed information about a chaos experiment by its experimentID.
Returns experimentID, identity, infraID, infraType, experimentType, revision history, and recent run details (resiliencyScore, experimentRunID, phase).`

	DescToolExperimentRunResult = `Retrieves the execution result of a specific chaos experiment run.
Returns run details including experimentID, experimentRunID, status, resiliencyScore, duration, infraID, and per-node execution data with chaosData (fault results, probe results, action results).`

	DescToolExperimentRun = `Run a chaos experiment by its experimentID.
If the experiment has required variables, they must be provided via experimentVariables and tasks parameters;
use chaos_experiment_variables_list to discover them beforehand.
Returns the initiated run details including experimentRunId, experimentId, and experimentName.`

	DescToolStopExperiment = `Stops a chaos experiment run.
If notifyId is set, the run is found by notifyId and scope; otherwise by experimentRunID and scope.
If both (notifyId and experimentRunID) are omitted, all runs for the experiment with phase 'Running' are stopped.
Returns isStopped, experimentId, and experimentName.`

	DescToolProbesList = `List the chaos probes.
Returns probes with probeId, name, type, infrastructureType, isEnabled, probeReferenceCount, runProperties, and recentProbeRuns.`

	DescToolProbeDescribe = `Retrieves detailed information about a chaos probe by its probeId.
Returns probeId, name, type, infrastructureType, isEnabled, runProperties, recentProbeRuns with fault associations and execution status.`

	DescToolGetProbeManifest = `Get the YAML manifest for a chaos probe by its ID (compatible with chaos engine).
Returns a JSON object with a 'manifest' field containing the raw YAML string.
Use when you need the engine-compatible YAML definition; use chaos_probe_describe for structured JSON with parsed fields.`

	DescToolEnableProbe = `Enable or disable a chaos probe by ID; optionally bulk-update across all experiments.
Returns a confirmation message string.`

	DescToolDeleteProbe = `Delete a chaos probe by its ID.
The probe must be disabled first (use chaos_enable_probe) and must not be in use by any experiment. Default probes cannot be deleted.
Returns {"response": true} on success.`

	DescToolVerifyProbe = `Verify or unverify a chaos probe by its ID. Default probes cannot be verified or unverified.
Returns a confirmation message string.`

	DescToolListProbesInExperimentRun = `Get probe execution details for one or more experiment runs.
At least one of experimentRunIds or notifyIds must be provided.
Returns probe status, mode, fault association, and configuration for each probe that participated in those runs.`

	DescToolListFaults = `List the chaos faults.
Returns a paginated list of faults with identity, name, category, type, infraType, variables, permissionsRequired, templateReference, and timestamps.`

	DescToolGetFaultVariables = `Retrieves the list of inputs and variables for a chaos fault by its identity.
Returns four groups: variables, faultAuthentication, faultTargets, and faultTunable — each containing name, value, type, description, and whether it is required.`

	DescToolGetFault = `Get details of a single chaos fault by its identity.
Returns the full fault definition including name, category, type, infraType, spec, variables, templateReference, managedBy, and isEnterprise.
Use when you need structured JSON fields; use chaos_get_fault_yaml for the raw YAML template.`

	DescToolGetFaultYaml = `Get the fault template YAML for a chaos fault by its identity.
Returns a JSON object with a 'template' field containing the raw YAML string.
Use when you need the raw YAML definition; use chaos_get_fault for structured JSON with parsed fields.`

	DescToolListFaultExperimentRuns = `List experiment runs that used a specific chaos fault.
Returns a paginated list of runs with experimentRunID, experimentID, experimentName, resiliencyScore, phase, faultIDs, runSequence, and timestamps.`

	DescToolDeleteFault = `Delete a chaos fault by its identity (soft delete).
The fault must not be in use by any experiment, otherwise the delete will be rejected.
Returns an empty object on success.`

	DescToolCreateExperimentFromTemplate = `Create a new chaos experiment from an experiment template.
Requires a templateId, infraId, environmentId, and hubIdentity. If name/identity are omitted, they are auto-generated from the template ID.
Returns the created experiment details including experimentID, identity, name, infraType, and manifest.`

	DescToolExperimentTemplateList = `List the chaos experiment templates.
Returns a paginated list of templates with identity, hubIdentity, revision, isDefault, infraType, infras, and variables.`

	DescToolExperimentVariablesList = `List the chaos experiment variables for a given experiment.
Use this before chaos_experiment_run to discover required experiment-level and task-level variables.
Returns experiment variables and per-task variables, each with name, value, type, description, and whether it is required.`

	DescToolListLinuxInfrastructures = `List available Linux infrastructure for chaos engineering and load testing.
Returns chaos Linux infrastructures (load infrastructures) with their IDs, names, and status.
Infra IDs are needed when creating sample load tests via chaos_create_sample_loadtest.
By default only active infrastructures are returned; set status to 'All' to list all.`

	DescToolListActions = `List chaos actions with optional filtering by name, infrastructure type, and action type.
Actions are reusable steps (delay, custom script, container) that can be added to chaos experiments.
Returns a paginated list of actions with identity, name, type, infrastructureType, variables, actionReferenceCount, and timestamps.`

	DescToolGetAction = `Get details of a chaos action by its identity.
Returns the action configuration including identity, name, type, infrastructureType, actionProperties, runProperties, variables, and recentExecutions.
Use when you need structured JSON fields; use chaos_get_action_manifest for the raw YAML manifest.`

	DescToolGetActionManifest = `Get the YAML manifest for a chaos action by its identity.
Returns a JSON object with a 'manifest' field containing the raw YAML string.
Use when you need the raw YAML definition; use chaos_get_action for structured JSON with parsed fields.`

	DescToolDeleteAction = `Delete a chaos action by its identity (soft delete).
The action must not be in use by any experiment, otherwise the delete will be rejected.
Returns {"deleted": true} on success.`

	// Parameter Descriptions
	DescExperimentID           = `Unique experiment identifier (UUID). Use chaos_experiments_list to find experiment IDs.`
	DescExperimentRunID        = `Unique experiment run identifier (UUID). Use chaos_experiment_describe to find run IDs.`
	DescExperimentRunIDStop    = `Unique identifier of the experiment run to stop. If omitted, the stop request may apply to the latest or all relevant runs depending on backend behavior.`
	DescNotifyId               = `Notification or callback identifier associated with the experiment run; used to correlate the stop request with the run that was started.`
	DescForce                  = `When true, immediately marks the run as Stopped in the database. When false (default), only requests stop on cluster/machine; DB is updated later when the infra reports status.`
	DescProbeId                = `Unique probe identifier. Use chaos_probes_list to find probe IDs.`
	DescProbeIdDelete          = `Unique identifier for the probe to delete. Use chaos_probes_list to find probe IDs.`
	DescProbeIdVerify          = `Unique identifier for the probe to verify. Use chaos_probes_list to find probe IDs.`
	DescIsEnabled              = `True to enable the probe, false to disable.`
	DescIsBulkUpdate           = `When true, enable/disable the probe across all experiments that use it. Defaults to false.`
	DescVerify                 = `True to verify the probe, false to unverify.`
	DescExperimentRunIds       = `List of experiment run IDs to fetch probe details for.`
	DescNotifyIds              = `List of notify IDs to fetch probe details for.`
	DescFaultIdentity          = `Unique identity of the fault. Use chaos_list_faults to find fault identities.`
	DescFaultIdentityDelete    = `Unique identity of the fault to delete. Use chaos_list_faults to find fault identities.`
	DescIsEnterprise           = `When true, filter for enterprise faults only. Defaults to false.`
	DescIsEnterpriseGet        = `When true, get an enterprise fault. Defaults to false.`
	DescIsEnterpriseYaml       = `When true, get YAML for an enterprise fault. Defaults to false.`
	DescIsEnterpriseVars       = `When true, get variables for an enterprise fault. Defaults to false.`
	DescIsEnterpriseRuns       = `When true, list runs for an enterprise fault. Defaults to false.`
	DescActionIdentity         = `Unique identity of the action. Use chaos_list_actions to find action identities.`
	DescActionIdentityGet      = `Unique identity of the action to retrieve. Use chaos_list_actions to find action identities.`
	DescActionIdentityDelete   = `Unique identity of the action to delete. Use chaos_list_actions to find action identities.`
	DescActionIdentityManifest = `Unique identity of the action. Use chaos_list_actions to find action identities.`
	DescTemplateId             = `Unique identifier for an experiment template. Use chaos_experiment_template_list to find template IDs.`
	DescInfraId                = `Unique identifier for an infrastructure. Use chaos_list_linux_infrastructures to find infra IDs.`
	DescEnvironmentId          = `Unique identifier for an environment.`
	DescHubIdentity            = `Unique identifier for a chaos hub.`
	DescExperimentName         = `User defined name of the experiment. If omitted, auto-generated from the template ID.`
	DescExperimentIdentity     = `User defined identity of the experiment. If omitted, auto-generated from the name.`
	DescInputsetIdentity       = `Optional inputset identity to use for the experiment run.`
	DescExperimentVariables    = `Optional experiment variables as an array of objects where each object has a name and value.`
	DescTasks                  = `Optional task-level variables as an object where each key is a task name and the value is an array of objects with name and value.`
	DescInfrastructureType     = `Infrastructure type filter for the experiment template.`
	DescSearchActions          = `Filter actions by name.`
	DescInfraType              = `Filter by infrastructure type.`
	DescEntityType             = `Filter by action type.`
	DescIncludeAllScope        = `When true, returns actions from all orgs and projects in the account. When false (default), returns only actions in the current org and project.`
	DescStatus                 = `Filter by infra status. Defaults to 'Active'. Use 'All' to list all infras regardless of status.`
	DescHubIdentityActions     = `Filter actions by chaos hub identity.`
)
