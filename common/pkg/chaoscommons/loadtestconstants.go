package chaoscommons

// Tool names for load test tools.
const (
	ToolListLoadTestInstances  = "chaos_list_loadtest_instances"
	ToolGetLoadTestInstance    = "chaos_get_loadtest_instance"
	ToolRunLoadTestInstance    = "chaos_run_loadtest_instance"
	ToolStopLoadTestRun        = "chaos_stop_loadtest_run"
	ToolDeleteLoadTestInstance = "chaos_delete_loadtest_instance"
	ToolCreateSampleLoadTest   = "chaos_create_sample_loadtest"
)

// Parameter names for load test tools.
const (
	ParamLoadTestID      = "load_test_id"
	ParamRunID           = "run_id"
	ParamTargetUsers     = "target_users"
	ParamDurationSeconds = "duration_seconds"
	ParamSpawnRate       = "spawn_rate"
	ParamInfraIDLoadTest = "infra_id"
)

// Parameter descriptions for load test tool parameters.
var (
	DescLoadTestID       = `The unique identifier of the load test. Use chaos_list_loadtest_instances to find load test IDs.`
	DescLoadTestIDRun    = `The unique identifier of the load test to run. Use chaos_list_loadtest_instances to find load test IDs.`
	DescLoadTestIDDelete = `The unique identifier of the load test to delete. Use chaos_list_loadtest_instances to find load test IDs.`
	DescRunID            = `The unique identifier of the load test run to stop. Use chaos_get_loadtest_instance to find active run IDs.`
	DescTargetUsers      = `Number of concurrent users to simulate. If omitted, the load test's default value is used.`
	DescDurationSeconds  = `Duration of the load test in seconds. If omitted, the load test's default value is used.`
	DescSpawnRate        = `Rate at which users are spawned per second. If omitted, the load test's default value is used.`
	DescLoadTestName     = `Name for the new sample load test.`
	DescLoadTestInfraID  = `The Linux infrastructure ID to use. Use chaos_list_linux_infrastructures to find available infrastructure IDs.`
)

// Tool descriptions for load test tools.
var (
	DescToolListLoadTestInstances = `List all load tests in the project.`

	DescToolGetLoadTestInstance = `Get details of a specific load test,
including its configuration, target URL, script content, and recent runs.
Use chaos_list_loadtest_instances to find load test IDs.`

	DescToolRunLoadTestInstance = `Run a load test.
If target_users, duration_seconds, or spawn_rate are not provided, the load test's default values will be used.
Use chaos_list_loadtest_instances to find load test IDs.`

	DescToolStopLoadTestRun = `Stop a running load test run.
Use chaos_get_loadtest_instance to find active run IDs.`

	DescToolDeleteLoadTestInstance = `Delete a load test.
Use chaos_list_loadtest_instances to find load test IDs.`

	DescToolCreateSampleLoadTest = `Create a sample load test.
Requires a name and a Linux infrastructure ID (use chaos_list_linux_infrastructures to find available infrastructure).`
)
