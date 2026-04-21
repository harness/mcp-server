// Auto-generated from /Users/rohangupta/code/spec/dist/schema.json (Harness v1 pipeline schema)
// @ts-nocheck

const schema: Record<string, any> = {
  "type": "object",
  "title": "pipeline_v1",
  "properties": {
    "pipeline": {
      "$ref": "#/definitions/pipeline_v1/pipeline_v1/Pipeline"
    }
  },
  "definitions": {
    "pipeline_v1": {
      "Action": {
        "anyOf": [
          {
            "$ref": "#/definitions/pipeline_v1/ActionType"
          },
          {
            "$ref": "#/definitions/pipeline_v1/ActionLong"
          }
        ]
      },
      "ActionLong": {
        "properties": {
          "abort": {
            "type": "boolean"
          },
          "fail": {
            "type": "boolean"
          },
          "ignore": {
            "type": "boolean"
          },
          "manual-intervention": {
            "$ref": "#/definitions/pipeline_v1/ActionManual"
          },
          "pipeline-rollback": {
            "type": "boolean"
          },
          "retry": {
            "$ref": "#/definitions/pipeline_v1/ActionRetry"
          },
          "retry-step-group": {
            "type": "boolean"
          },
          "stage-rollback": {
            "type": "boolean"
          },
          "success": {
            "type": "boolean"
          }
        },
        "type": "object"
      },
      "ActionManual": {
        "properties": {
          "timeout": {
            "type": "string"
          },
          "timeout-action": {
            "$ref": "#/definitions/pipeline_v1/Action"
          }
        },
        "type": "object",
        "x-go-file": "action_manual.go"
      },
      "ActionRetry": {
        "properties": {
          "attempts": {
            "type": "number"
          },
          "failure-action": {
            "$ref": "#/definitions/pipeline_v1/Action"
          },
          "interval": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          }
        },
        "type": "object",
        "x-go-file": "action_retry.go"
      },
      "ActionType": {
        "enum": [
          "abort",
          "fail",
          "ignore",
          "manual-intervention",
          "pipeline-rollback",
          "retry",
          "retry-step-group",
          "stage-rollback",
          "success"
        ],
        "type": "string"
      },
      "Cache": {
        "description": "Cache defines pipeline caching behavior.",
        "properties": {
          "disabled": {
            "description": "Disabled disables cache intelligence.",
            "type": "boolean"
          },
          "key": {
            "description": "Key provides a caching key.",
            "type": "string"
          },
          "path": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Paths provides one or more paths to cache."
          },
          "policy": {
            "description": "Policy configures the pull and push behavior of the cache. By default, the stage pulls the cache when the stage starts and pushes changes to the cache when the stage ends.",
            "enum": [
              "pull",
              "pull-push",
              "push"
            ],
            "type": "string"
          }
        },
        "type": "object"
      },
      "Clone": {
        "anyOf": [
          {
            "type": "boolean"
          },
          {
            "$ref": "#/definitions/pipeline_v1/CloneLong"
          }
        ]
      },
      "CloneLong": {
        "properties": {
          "depth": {
            "description": "Depth defines the clone depth.",
            "type": "number"
          },
          "disabled": {
            "description": "Disabled disables the default clone step.",
            "type": "boolean"
          },
          "insecure": {
            "description": "Insecure enables cloning without ssl verification.",
            "type": "boolean"
          },
          "lfs": {
            "description": "Lfs enables cloning lfs files.",
            "type": "boolean"
          },
          "ref": {
            "$ref": "#/definitions/pipeline_v1/CloneRef",
            "description": "Reference defines the clone ref."
          },
          "strategy": {
            "description": "Strategy configures the clone strategy.",
            "enum": [
              "source-branch",
              "merge"
            ],
            "type": "string"
          },
          "submodules": {
            "description": "Submodules enables cloning all submodules;",
            "type": "boolean"
          },
          "tags": {
            "description": "Tags enables cloning all tags;",
            "type": "boolean"
          },
          "trace": {
            "description": "Trace enables trace logging.",
            "type": "boolean"
          }
        },
        "type": "object"
      },
      "CloneRef": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/CloneRefLong"
          }
        ]
      },
      "CloneRefLong": {
        "properties": {
          "name": {
            "description": "Name provides the ref name. This can be the branch or tag name. Or this can be the full reference, e.g. refs/heads/main.",
            "type": "string"
          },
          "sha": {
            "description": "Sha provides the commit sha.",
            "type": "string"
          },
          "type": {
            "description": "Type provides the ref type. If undefined, the reference name is used to determine the reference type.",
            "enum": [
              "branch",
              "pull-request",
              "tag"
            ],
            "type": "string"
          }
        },
        "type": "object"
      },
      "Concurrency": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/ConcurrencyLong"
          }
        ],
        "description": "Concurrency groups provide a way to limit concurrency execution of pipelines that share the same concurrency key."
      },
      "ConcurrencyLong": {
        "properties": {
          "cancel-in-progress": {
            "description": "Cancel any in-progress pipelines or stages that are in-progress when a new pipeline or stage is received.",
            "type": "boolean"
          },
          "group": {
            "description": "Group provides the key used to group pipelines or stages together into a concurrency group.",
            "type": "string"
          }
        },
        "type": "object"
      },
      "Container": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/ContainerLong"
          }
        ]
      },
      "ContainerLong": {
        "description": "ContainerLong defines the container configuration syntax in long form.",
        "properties": {
          "args": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "connector": {
            "description": "Connector provides the Connect used to authenticate to the registry.",
            "type": "string"
          },
          "cpu": {
            "type": [
              "string",
              "number"
            ]
          },
          "credentials": {
            "$ref": "#/definitions/pipeline_v1/Credentials",
            "description": "Credentials provides the registry authentication credentials."
          },
          "dns": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "entrypoint": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env provides the container environment variables.",
            "type": "object"
          },
          "extra-hosts": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "group": {
            "type": [
              "string",
              "number"
            ]
          },
          "image": {
            "description": "Image defines the container image.",
            "type": "string"
          },
          "memory": {
            "type": [
              "string",
              "number"
            ]
          },
          "network": {
            "type": "string"
          },
          "network-mode": {
            "type": "string"
          },
          "ports": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "privileged": {
            "type": "boolean"
          },
          "pull": {
            "enum": [
              "always",
              "never",
              "if-not-exists"
            ],
            "type": "string"
          },
          "shm-size": {
            "type": [
              "string",
              "number"
            ]
          },
          "user": {
            "type": [
              "string",
              "number"
            ]
          },
          "volumes": {
            "items": {
              "$ref": "#/definitions/pipeline_v1/Mount"
            },
            "type": "array"
          },
          "workdir": {
            "type": "string"
          }
        },
        "type": "object"
      },
      "Credentials": {
        "properties": {
          "aws": {
            "$ref": "#/definitions/pipeline_v1/CredentialsAWS",
            "description": "AWS defines registry credentials for amazon web services."
          },
          "password": {
            "description": "Password provides the registry password.",
            "type": "string"
          },
          "username": {
            "description": "Username provides the registry username.",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "credentials.go"
      },
      "CredentialsAWS": {
        "properties": {
          "access-key": {
            "description": "AccessKey provides the aws access key id.",
            "type": "string"
          },
          "secret-key": {
            "description": "SecretKey provides the aws access key secret.",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "credentials_aws.go"
      },
      "Delegate": {
        "anyOf": [
          {
            "const": "inherit-from-infrastrcuture",
            "type": "string"
          },
          {
            "type": "string"
          },
          {
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        ]
      },
      "Environment": {
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "org": {
            "deprecated": true,
            "type": "string"
          },
          "project": {
            "deprecated": true,
            "type": "string"
          },
          "tags": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object"
          },
          "type": {
            "$ref": "#/definitions/pipeline_v1/EnvironmentType"
          }
        },
        "type": "object"
      },
      "EnvironmentItem": {
        "properties": {
          "deploy-to": {
            "anyOf": [
              {
                "const": "all",
                "type": "string"
              },
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "DeployToAll deploys to all infrastructure definitions (clusters) associated with the environment."
          },
          "name": {
            "description": "Name provides the environment name.",
            "type": "string"
          }
        },
        "type": "object"
      },
      "EnvironmentRef": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/EnvironmentRefLong"
          }
        ]
      },
      "EnvironmentRefLong": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/definitions/pipeline_v1/EnvironmentItem"
            },
            "type": "array"
          },
          "parallel": {
            "type": "boolean"
          }
        },
        "type": "object"
      },
      "EnvironmentType": {
        "enum": [
          "production",
          "non-production"
        ],
        "type": "string"
      },
      "Event": {
        "anyOf": [
          {
            "$ref": "#/definitions/pipeline_v1/EventType"
          },
          {
            "$ref": "#/definitions/pipeline_v1/EventLong"
          }
        ]
      },
      "EventFilter": {
        "properties": {
          "types": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          }
        },
        "type": "object"
      },
      "EventLong": {
        "properties": {
          "branch_protection_rule": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "check_run": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "check_suite": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "create": {},
          "delete": {},
          "deployment": {},
          "deployment_status": {},
          "discussion": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "discussion_comment": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "fork": {},
          "issue_comment": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "issues": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "label": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "member": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "merge_group": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "milestone": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "page_build": {},
          "project": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "project_card": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "project_column": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "public": {},
          "pull_request": {
            "$ref": "#/definitions/pipeline_v1/PullRequestFilter"
          },
          "pull_request_review": {
            "$ref": "#/definitions/pipeline_v1/Event"
          },
          "pull_request_review_comment": {
            "$ref": "#/definitions/pipeline_v1/Event"
          },
          "pull_request_target": {
            "$ref": "#/definitions/pipeline_v1/PullRequestFilter"
          },
          "push": {
            "$ref": "#/definitions/pipeline_v1/PushFilter"
          },
          "registry_package": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "release": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "repository_dispatch": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "schedule": {},
          "status": {},
          "watch": {
            "$ref": "#/definitions/pipeline_v1/EventFilter"
          },
          "workflow_call": {},
          "workflow_dispatch": {},
          "workflow_run": {}
        },
        "type": "object"
      },
      "EventType": {
        "enum": [
          "branch_protection_rule",
          "check_run",
          "check_suite",
          "create",
          "delete",
          "deployment",
          "deployment_status",
          "discussion",
          "discussion_comment",
          "fork",
          "issue_comment",
          "issues",
          "label",
          "member",
          "merge_group",
          "milestone",
          "page_build",
          "project",
          "project_card",
          "project_column",
          "public",
          "pull_request",
          "pull_request_review",
          "pull_request_review_comment",
          "pull_request_target",
          "push",
          "registry_package",
          "repository_dispatch",
          "release",
          "schedule",
          "status",
          "watch",
          "workflow_call",
          "workflow_dispatch",
          "workflow_run"
        ],
        "type": "string"
      },
      "FailureStrategy": {
        "properties": {
          "action": {
            "$ref": "#/definitions/pipeline_v1/Action"
          },
          "errors": {
            "anyOf": [
              {
                "$ref": "#/definitions/pipeline_v1/FailureType"
              },
              {
                "items": {
                  "$ref": "#/definitions/pipeline_v1/FailureType"
                },
                "type": "array"
              }
            ]
          }
        },
        "type": "object"
      },
      "FailureType": {
        "enum": [
          "all",
          "approval-rejection",
          "authentication",
          "authorization",
          "connectivity",
          "delegate-provisioning",
          "delegate-restart",
          "input-timeout",
          "policy-evaluation",
          "timeout",
          "unknown",
          "verification",
          "user-mark-fail"
        ],
        "type": "string"
      },
      "For": {
        "description": "For defines a for loop execution strategy.",
        "properties": {
          "iterations": {
            "description": "Iterations defines maximum number of interations.",
            "type": "number"
          }
        },
        "type": "object",
        "x-go-file": "strategy_for.go"
      },
      "InfraSchema": {
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "org": {
            "deprecated": true,
            "type": "string"
          },
          "project": {
            "deprecated": true,
            "type": "string"
          },
          "tags": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object"
          }
        },
        "type": "object",
        "x-go-file": "schema_infra.go"
      },
      "Input": {
        "properties": {
          "autofocus": {
            "description": "Autofocus configures the form element autofocus attribute.",
            "type": "boolean"
          },
          "component": {
            "description": "Component defines the form element that should be used to render the input.",
            "type": "string"
          },
          "default": {},
          "description": {
            "description": "Description defines the input description.",
            "type": "string"
          },
          "enum": {
            "description": "Enum defines a list of accepted input values.",
            "items": {},
            "type": "array"
          },
          "items": {
            "description": "Items defines an array type.",
            "items": {},
            "type": "array"
          },
          "mask": {
            "deprecated": true,
            "description": "Mask indicates the input should be masked.",
            "type": "boolean"
          },
          "options": {
            "description": "Options defines a list of accepted input values. This is an alias for enum.",
            "items": {},
            "type": "array"
          },
          "pattern": {
            "description": "Pattern defines a regular expression input constraint.",
            "type": "string"
          },
          "placeholder": {
            "description": "Placeholder configures the form element placeholder attribute.",
            "type": "string"
          },
          "required": {
            "description": "Required indicates the input is required.",
            "type": "boolean"
          },
          "tooltip": {
            "description": "Tooltip configures the form element alt attribute.",
            "type": "string"
          },
          "type": {
            "description": "Type defines the input type.",
            "enum": [
              "string",
              "number",
              "boolean",
              "array",
              "duration",
              "choice",
              "environment",
              "secret"
            ],
            "type": "string"
          }
        },
        "required": [
          "type"
        ],
        "type": "object",
        "x-go-file": "input.go"
      },
      "MachineImage": {
        "description": "MachineImage defines possible machine image values.",
        "enum": [
          "ubuntu-latest",
          "macos-latest",
          "wndows-latest"
        ],
        "type": "string"
      },
      "MachineSize": {
        "description": "MachineImage defines machine size values.",
        "enum": [
          "flex",
          "small",
          "medium",
          "large",
          "xlarge",
          "xxlarge"
        ],
        "type": "string"
      },
      "Matrix": {
        "description": "Matrix defines a matrix execution strategy.",
        "properties": {
          "exclude": {
            "items": {
              "type": "object"
            },
            "type": "array"
          },
          "include": {
            "items": {
              "type": "object"
            },
            "type": "array"
          }
        },
        "type": "object",
        "x-go-file": "strategy_matrix.go"
      },
      "Mount": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/MountLong"
          }
        ]
      },
      "MountLong": {
        "properties": {
          "source": {
            "type": "string"
          },
          "target": {
            "type": "string"
          }
        },
        "required": [
          "source",
          "target"
        ],
        "type": "object"
      },
      "On": {
        "anyOf": [
          {
            "$ref": "#/definitions/pipeline_v1/EventType"
          },
          {
            "items": {
              "$ref": "#/definitions/pipeline_v1/Event"
            },
            "type": "array"
          },
          {
            "$ref": "#/definitions/pipeline_v1/Event"
          }
        ]
      },
      "Permissions": {
        "anyOf": [
          {
            "const": "write-all",
            "type": "string"
          },
          {
            "const": "read-all",
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/PermissionsLong"
          }
        ],
        "description": "Permissions defines the permission granted to the token injected into the pipeline environment."
      },
      "PermissionsLong": {
        "properties": {
          "actions": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "checks": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "contents": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "deployments": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "discussions": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "id-token": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "issues": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "packages": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "pages": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "pull-requests": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "repository-projects": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "security-events": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          },
          "statuses": {
            "enum": [
              "read",
              "write",
              "none"
            ],
            "type": "string"
          }
        },
        "type": "object"
      },
      "Pipeline": {
        "properties": {
          "barriers": {
            "description": "Barriers provides optional pipeline barriers.",
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "clone": {
            "$ref": "#/definitions/pipeline_v1/Clone",
            "description": "Clone overrides the default clone behavior."
          },
          "concurrency": {
            "$ref": "#/definitions/pipeline_v1/Concurrency",
            "description": "Concurrency groups provide a way to limit concurrency execution of pipelines that share the same concurrency key."
          },
          "default": {},
          "delegate": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Delegage defines the default delegate that should handle stage execution. This is optional."
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env provides global environment variables that propagate to all pipeline steps.",
            "type": "object"
          },
          "environment": {
            "$ref": "#/definitions/pipeline_v1/EnvironmentRef",
            "description": "Environment defines the target deployment environment (e.g. development, prod)."
          },
          "generate": {
            "$ref": "#/definitions/pipeline_v1/Stage",
            "description": "Generate defines custom logic to dynamically generate a pipeline."
          },
          "id": {
            "deprecated": true,
            "description": "Id provides a unique pipeline identifer.",
            "type": "string"
          },
          "if": {
            "description": "If provides conditional pipeline execution logic. If the condition resolves to false, the pipeline is skipped.",
            "type": "string"
          },
          "inputs": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Input"
            },
            "description": "Inputs provides pipeline input variables.",
            "type": "object"
          },
          "jobs": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Stage"
            },
            "description": "Jobs defines jobs (stages) in the pipeline.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "name": {
            "deprecated": true,
            "description": "Name provides a pipeline name.",
            "type": "string"
          },
          "on": {
            "$ref": "#/definitions/pipeline_v1/On",
            "description": "On provides condition pipeline execution logic based on trigger event and action mapping. If the conditional logic resolves to folse, the pipeline is skipped."
          },
          "permissions": {
            "$ref": "#/definitions/pipeline_v1/Permissions"
          },
          "repo": {
            "$ref": "#/definitions/pipeline_v1/Repository",
            "description": "Repo overrides the default repository."
          },
          "service": {
            "$ref": "#/definitions/pipeline_v1/ServiceRef",
            "description": "Service defines the service being deployed."
          },
          "stages": {
            "description": "Stages provides a list of stages. Each pipeline is made up of one or more stages that executes sequentially.",
            "items": {
              "$ref": "#/definitions/pipeline_v1/Stage"
            },
            "type": "array"
          },
          "status": {
            "$ref": "#/definitions/pipeline_v1/Status",
            "description": "Status overrides the default status behavior."
          },
          "timeout": {
            "description": "Timeout defines the step timeout duration.",
            "format": "duration",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "pipeline.go"
      },
      "Platform": {
        "description": "Platform defines the target execution environment.",
        "properties": {
          "arch": {
            "description": "OS defines the target operating system.",
            "type": "string"
          },
          "features": {
            "description": "Features defines the target platform features. Not currently used.",
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "os": {
            "description": "Arch defines the target cpu architecture.",
            "type": "string"
          },
          "variant": {
            "description": "Variant defines the target cpu architecture variant. Not currently used.",
            "type": "string"
          },
          "version": {
            "description": "Version defines the target operating system version. Not currently used.",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "platform.go"
      },
      "PullRequestFilter": {
        "properties": {
          "branches": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "branches-ignore": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "paths": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "paths-ignore": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "review-approved": {
            "type": "boolean"
          },
          "review-dismissed": {
            "type": "boolean"
          },
          "tags": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "tags-ignore": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "types": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          }
        },
        "type": "object"
      },
      "PushFilter": {
        "properties": {
          "branches": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "branches-ignore": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "paths": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "paths-ignore": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "tags": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          },
          "tags-ignore": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ]
          }
        },
        "type": "object"
      },
      "Report": {
        "properties": {
          "path": {
            "type": "string"
          },
          "type": {
            "enum": [
              "junit",
              "xunit",
              "nunit"
            ],
            "type": "string"
          }
        },
        "type": "object"
      },
      "ReportList": {
        "anyOf": [
          {
            "$ref": "#/definitions/pipeline_v1/Report"
          },
          {
            "items": {
              "$ref": "#/definitions/pipeline_v1/Report"
            },
            "type": "array"
          }
        ]
      },
      "Repository": {
        "description": "Repository defines a remote git repository.",
        "properties": {
          "connector": {
            "description": "Connector provides the repository connector.",
            "type": "string"
          },
          "name": {
            "description": "Name provides the repository name.",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "repository.go"
      },
      "Runtime": {
        "anyOf": [
          {
            "$ref": "#/definitions/pipeline_v1/RuntimeShort"
          },
          {
            "$ref": "#/definitions/pipeline_v1/RuntimeLong"
          }
        ]
      },
      "RuntimeCloud": {
        "description": "RuntimeClone configures the cloud runtime environment.",
        "properties": {
          "image": {
            "$ref": "#/definitions/pipeline_v1/MachineImage"
          },
          "size": {
            "$ref": "#/definitions/pipeline_v1/MachineSize"
          }
        },
        "type": "object"
      },
      "RuntimeInstance": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/RuntimeInstanceLong"
          }
        ]
      },
      "RuntimeInstanceLong": {
        "description": "RuntimeInstanceLong configures the vm runtime environment.",
        "properties": {
          "image": {
            "type": "string"
          }
        },
        "type": "object"
      },
      "RuntimeKubernetes": {
        "description": "RuntimeKubernetes configures the kubernetes runtime environment.",
        "properties": {
          "connector": {
            "type": "string"
          },
          "namespace": {
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "runtime_kubernetes.go"
      },
      "RuntimeLong": {
        "description": "RuntimeLong configures the runtime environment.",
        "properties": {
          "cloud": {
            "$ref": "#/definitions/pipeline_v1/RuntimeCloud"
          },
          "kubernetes": {
            "$ref": "#/definitions/pipeline_v1/RuntimeKubernetes"
          },
          "shell": {
            "type": "boolean"
          },
          "vm": {
            "$ref": "#/definitions/pipeline_v1/RuntimeInstance"
          }
        },
        "type": "object"
      },
      "RuntimeShort": {
        "enum": [
          "cloud",
          "vm",
          "kubernetes",
          "shell"
        ],
        "type": "string"
      },
      "Schema": {
        "properties": {
          "action": {
            "$ref": "#/definitions/pipeline_v1/Template",
            "deprecated": "use \"template\" instead",
            "description": "Action defines re-usable pipeline steps and stages."
          },
          "concurrency": {
            "$ref": "#/definitions/pipeline_v1/Concurrency",
            "description": "Concurrency groups provide a way to limit concurrency execution of pipelines that share the same concurrency key."
          },
          "defaults": {
            "description": "Defaults provides default settings that apply to all jobs in the workflow.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Envs defines environment variables that are available to all steps in the workflow.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "environment": {
            "$ref": "#/definitions/pipeline_v1/Environment",
            "description": "Environment defines a deployment environment."
          },
          "infrastructure": {
            "$ref": "#/definitions/pipeline_v1/InfraSchema",
            "description": "Infrastructure defines the service infrastructure."
          },
          "inputset": {
            "description": "Inputset defines re-usable inputs.",
            "type": "object"
          },
          "jobs": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Stage"
            },
            "description": "Jobs defines the parallel workflow jobs.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "name": {
            "description": "Name defines the pipeline name.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "string"
          },
          "on": {
            "$ref": "#/definitions/pipeline_v1/On",
            "description": "On defines the workflow triggers.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions."
          },
          "permissions": {
            "$ref": "#/definitions/pipeline_v1/Permissions",
            "description": "Permissions defines the permission granted to the token injected into the pipeline environment."
          },
          "pipeline": {
            "$ref": "#/definitions/pipeline_v1/Pipeline",
            "description": "Pipeline defines the pipeline configuration."
          },
          "service": {
            "$ref": "#/definitions/pipeline_v1/Service",
            "description": "Service defines a service."
          },
          "template": {
            "$ref": "#/definitions/pipeline_v1/Template",
            "description": "Template defines re-usable pipeline steps and stages."
          },
          "version": {
            "description": "Version defines the schema version.",
            "type": [
              "string",
              "number"
            ]
          }
        },
        "type": "object",
        "x-go-file": "schema.go"
      },
      "Service": {
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "org": {
            "deprecated": true,
            "type": "string"
          },
          "project": {
            "deprecated": true,
            "type": "string"
          },
          "tags": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object"
          }
        },
        "type": "object"
      },
      "ServiceRef": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          {
            "$ref": "#/definitions/pipeline_v1/ServiceRefLong"
          }
        ]
      },
      "ServiceRefLong": {
        "properties": {
          "items": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "parallel": {
            "type": "boolean"
          }
        },
        "required": [
          "items"
        ],
        "type": "object"
      },
      "Stage": {
        "properties": {
          "approval": {
            "$ref": "#/definitions/pipeline_v1/StageApproval",
            "description": "Approval defines an approval stage."
          },
          "cache": {
            "$ref": "#/definitions/pipeline_v1/Cache",
            "description": "Cache defines the cache configuration."
          },
          "clone": {
            "$ref": "#/definitions/pipeline_v1/Clone",
            "description": "Clone overrides the default clone settings."
          },
          "concurrency": {
            "$ref": "#/definitions/pipeline_v1/Concurrency",
            "description": "Concurrency groups provide a way to limit concurrency execution of pipelines that share the same concurrency key."
          },
          "delegate": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Delegage defines the delegate that should handle stage execution. This is optional."
          },
          "disabled": {
            "description": "Disabled disables the stage.",
            "type": "boolean"
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env defines the environment of the stage. These environment variables are shared by all steps in the stage.",
            "type": "object"
          },
          "environment": {
            "$ref": "#/definitions/pipeline_v1/EnvironmentRef",
            "description": "Environment defines the deployment environment (production, staging)."
          },
          "group": {
            "$ref": "#/definitions/pipeline_v1/StageGroup",
            "description": "Group defines a group of stages."
          },
          "id": {
            "description": "Id defines the pipeline id.",
            "type": "string"
          },
          "if": {
            "description": "If defines conditional execution logic.",
            "type": "string"
          },
          "inputs": {
            "$ref": "#/definitions/pipeline_v1/Input",
            "description": "Inputs provides stage input variables."
          },
          "name": {
            "description": "Name defines the pipeline name.",
            "type": "string"
          },
          "needs": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Needs defines stages that must be completed before this stage can run."
          },
          "on-failure": {
            "$ref": "#/definitions/pipeline_v1/FailureStrategy"
          },
          "outputs": {
            "description": "Outputs configures the stage to export variables for use by other stages.",
            "type": "object"
          },
          "parallel": {
            "$ref": "#/definitions/pipeline_v1/StageGroup",
            "description": "Parallel defines a set of parallel stages."
          },
          "permissions": {
            "$ref": "#/definitions/pipeline_v1/Permissions",
            "description": "Permissions defines the permission granted to the token injected into the stage environment."
          },
          "platform": {
            "$ref": "#/definitions/pipeline_v1/Platform",
            "description": "Platform defines the target platform."
          },
          "rollback": {
            "$ref": "#/definitions/pipeline_v1/Step",
            "description": "Rollback defines the rollback steps."
          },
          "runs-on": {
            "description": "RunsOn defines the type of machine to run the job.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "string"
          },
          "runtime": {
            "$ref": "#/definitions/pipeline_v1/Runtime",
            "description": "Runtime defines the execution runtime."
          },
          "service": {
            "$ref": "#/definitions/pipeline_v1/ServiceRef",
            "description": "Service defines the deployment target."
          },
          "services": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Container"
            },
            "description": "Services defines background service containers.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "status": {
            "$ref": "#/definitions/pipeline_v1/Status",
            "description": "Status overrides the default status settings."
          },
          "steps": {
            "description": "Steps defines a list of steps.",
            "items": {
              "$ref": "#/definitions/pipeline_v1/Step"
            },
            "type": "array"
          },
          "strategy": {
            "$ref": "#/definitions/pipeline_v1/Strategy",
            "description": "Strategy defines the matrix or looping strategy."
          },
          "template": {
            "$ref": "#/definitions/pipeline_v1/StageTemplate",
            "description": "Template defines a stage template."
          },
          "volumes": {
            "items": {
              "$ref": "#/definitions/pipeline_v1/Volume"
            },
            "type": "array"
          },
          "workspace": {
            "$ref": "#/definitions/pipeline_v1/Workspace",
            "description": "Workspace configures the local workspace directory."
          }
        },
        "type": "object",
        "x-go-file": "stage.go"
      },
      "StageApproval": {
        "properties": {
          "uses": {
            "type": "string"
          },
          "with": {
            "type": "object"
          }
        },
        "type": "object",
        "x-go-file": "stage_approval.go"
      },
      "StageGroup": {
        "properties": {
          "parallel": {
            "deprecated": true,
            "description": "Parallel defines the maximum number of stages that can run in parallel. If unset or zero, the stages run sequentially.",
            "type": "number"
          },
          "stages": {
            "description": "Stages defines a list of stages.",
            "items": {
              "$ref": "#/definitions/pipeline_v1/Stage"
            },
            "type": "array"
          }
        },
        "type": "object",
        "x-go-file": "stage_group.go"
      },
      "StageTemplate": {
        "properties": {
          "uses": {
            "type": "string"
          },
          "with": {
            "type": "object"
          }
        },
        "type": "object",
        "x-go-file": "stage_template.go"
      },
      "Status": {
        "properties": {
          "disabled": {
            "description": "Disabled disables the status check.",
            "type": "boolean"
          },
          "level": {
            "description": "Level stes the status level.",
            "enum": [
              "pipeline",
              "stage",
              "step"
            ],
            "type": "string"
          },
          "matrix": {
            "description": "Matrix defines how matrix statuses are handled.",
            "enum": [
              "itemize",
              "aggregate"
            ],
            "type": "string"
          },
          "name": {
            "description": "Name sets the default status name.",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "status.go"
      },
      "Step": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/definitions/pipeline_v1/StepLong"
          }
        ]
      },
      "StepAction": {
        "properties": {
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env defines the environment of the step.",
            "type": "object"
          },
          "report": {
            "$ref": "#/definitions/pipeline_v1/ReportList",
            "description": "Report uploads reports at the the provided path(s)"
          },
          "uses": {
            "description": "Uses defines the action.",
            "type": "string"
          },
          "with": {
            "description": "With defines the action configuration parameters.",
            "type": "object"
          }
        },
        "type": "object",
        "x-go-file": "step_action.go"
      },
      "StepApproval": {
        "properties": {
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "type": "object"
          },
          "uses": {
            "type": "string"
          },
          "with": {
            "type": "object"
          }
        },
        "type": "object",
        "x-go-file": "step_approval.go"
      },
      "StepBarrier": {
        "properties": {
          "name": {
            "type": "string"
          }
        },
        "required": [
          "name"
        ],
        "type": "object",
        "x-go-file": "step_barrier.go"
      },
      "StepClone": {
        "properties": {
          "clean": {
            "description": "Clean enables running git clean and git reset before fetching.",
            "type": "boolean"
          },
          "connector": {
            "description": "Connector provides the repository connector.",
            "type": "string"
          },
          "depth": {
            "description": "Depth defines the clone depth.",
            "type": "number"
          },
          "disabled": {
            "description": "Disabled disables the default clone step.",
            "type": "boolean"
          },
          "filter": {
            "description": "Filter configures partial cloning against the given filter. This overrides sparse checkout if set.",
            "type": "string"
          },
          "insecure": {
            "description": "Insecure enables cloning without ssl verification.",
            "type": "boolean"
          },
          "lfs": {
            "description": "Lfs enables cloning lfs files.",
            "type": "boolean"
          },
          "path": {
            "description": "Path provides the relative path in the workspace where the repository is cloned.",
            "type": "string"
          },
          "ref": {
            "$ref": "#/definitions/pipeline_v1/CloneRef",
            "description": "Reference defines the clone ref."
          },
          "repo": {
            "description": "Repo provides the repository name.",
            "type": "string"
          },
          "set-safe-directory": {
            "description": "SetSafeDirectory adds the repository path as safe.directory for the global git configuration.",
            "type": "boolean"
          },
          "sparse-checkout": {
            "description": "SparseCheckout enables sparse checkout on given patterns. Each pattern should be separated with new lines.",
            "type": "string"
          },
          "sparse-checkout-cone-mode": {
            "description": "SparseCheckoutCodeMode enables cone-mode when doing a sparse checkout.",
            "type": "string"
          },
          "strategy": {
            "description": "Strategy configures the clone strategy.",
            "enum": [
              "source-branch",
              "merge"
            ],
            "type": "string"
          },
          "submodules": {
            "description": "Submodules enables cloning all submodules;",
            "type": "boolean"
          },
          "tags": {
            "description": "Tags enables cloning all tags;",
            "type": "boolean"
          },
          "trace": {
            "description": "Trace enables trace logging.",
            "type": "boolean"
          }
        },
        "type": "object"
      },
      "StepGroup": {
        "properties": {
          "parallel": {
            "deprecated": true,
            "description": "Parallel defines the maximum number of steps that can run in parallel. If unset or zero, the steps run sequentially.",
            "type": [
              "number",
              "boolean"
            ]
          },
          "steps": {
            "description": "Steps defines a list of steps.",
            "items": {
              "$ref": "#/definitions/pipeline_v1/Step"
            },
            "type": "array"
          }
        },
        "type": "object",
        "x-go-file": "step_group.go"
      },
      "StepLong": {
        "properties": {
          "action": {
            "$ref": "#/definitions/pipeline_v1/StepAction",
            "description": "Action defines an action step."
          },
          "approval": {
            "$ref": "#/definitions/pipeline_v1/StepApproval",
            "description": "Approval defines an approval step."
          },
          "background": {
            "$ref": "#/definitions/pipeline_v1/StepRun",
            "description": "Background defines a background step."
          },
          "barrier": {
            "$ref": "#/definitions/pipeline_v1/StepBarrier",
            "description": "Barrier defines a step barrier."
          },
          "clone": {
            "$ref": "#/definitions/pipeline_v1/StepClone",
            "description": "Clone clones a git repository."
          },
          "delegate": {
            "$ref": "#/definitions/pipeline_v1/Delegate",
            "description": "This property is available solely for the purpose of backward compatibility with Harness Currrent Gen."
          },
          "disabled": {
            "description": "Disabled disables the step.",
            "type": "boolean"
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env defines the environment of the step.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "group": {
            "$ref": "#/definitions/pipeline_v1/StepGroup",
            "description": "Group defines a step group."
          },
          "id": {
            "description": "Id defines the step id.",
            "type": "string"
          },
          "if": {
            "description": "If defines conditional execution logic.",
            "type": "string"
          },
          "name": {
            "description": "Name defines the step name.",
            "type": "string"
          },
          "needs": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Needs defines steps that must be completed before this step can run."
          },
          "on-failure": {
            "$ref": "#/definitions/pipeline_v1/FailureStrategy",
            "description": "FailureStrategy defines error handling."
          },
          "parallel": {
            "$ref": "#/definitions/pipeline_v1/StepGroup",
            "description": "Parallel defines a parallel step group."
          },
          "queue": {
            "$ref": "#/definitions/pipeline_v1/StepQueue",
            "description": "Queue defines a queue step."
          },
          "run": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "$ref": "#/definitions/pipeline_v1/StepRun"
              }
            ],
            "description": "Run defines a run step."
          },
          "run-test": {
            "$ref": "#/definitions/pipeline_v1/StepTest",
            "description": "Test defines a run test step"
          },
          "status": {
            "$ref": "#/definitions/pipeline_v1/Status",
            "description": "Status overrides the default status settings."
          },
          "strategy": {
            "$ref": "#/definitions/pipeline_v1/Strategy",
            "description": "Strategy defines the matrix or looping strategy."
          },
          "template": {
            "$ref": "#/definitions/pipeline_v1/StepTemplate",
            "description": "Template defines a step template."
          },
          "timeout": {
            "description": "Timeout defines the step timeout duration.",
            "format": "duration",
            "type": "string"
          },
          "uses": {
            "description": "Uses defines the github action.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "string"
          },
          "with": {
            "description": "With defines the github action configuration parameters.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          }
        },
        "type": "object"
      },
      "StepQueue": {
        "properties": {
          "key": {
            "type": "string"
          },
          "scope": {
            "enum": [
              "pipeline",
              "stage"
            ],
            "type": "string"
          }
        },
        "required": [
          "key"
        ],
        "type": "object",
        "x-go-file": "step_queue.go"
      },
      "StepRun": {
        "properties": {
          "container": {
            "$ref": "#/definitions/pipeline_v1/Container",
            "description": "Container runs the step inside a container. If you do not set a container, the step will run directly on the host unless the target runtime in kubernetes, in which case the container is required."
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env defines the environment of the step.",
            "type": "object"
          },
          "report": {
            "$ref": "#/definitions/pipeline_v1/ReportList",
            "description": "Report uploads reports at the the provided path(s)"
          },
          "script": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Script runs command line scripts using the operating system's shell. Each script represents a new process and shell in the runner environment. Note that when you provide multi-line commands, each line runs in the same shell."
          },
          "shell": {
            "description": "Shell defines the shell of the step.",
            "enum": [
              "sh",
              "bash",
              "powershell",
              "pwsh",
              "python"
            ],
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "step_run.go"
      },
      "StepTemplate": {
        "properties": {
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env defines the environment of the step.",
            "type": "object"
          },
          "uses": {
            "description": "Uses defines the template.",
            "type": "string"
          },
          "with": {
            "description": "With defines the template configuration parameters.",
            "type": "object"
          }
        },
        "type": "object",
        "x-go-file": "step_template.go"
      },
      "StepTest": {
        "properties": {
          "container": {
            "$ref": "#/definitions/pipeline_v1/Container",
            "description": "Container runs the step inside a container. If you do not set a container, the step will run directly on the host unless the target runtime in kubernetes, in which case the container is required."
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env defines the environment of the step.",
            "type": "object"
          },
          "intelligence": {
            "$ref": "#/definitions/pipeline_v1/TestIntelligence",
            "description": "Intelligence configures the test intelligence behavior."
          },
          "match": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Match provides unit test matching logic in glob format."
          },
          "report": {
            "$ref": "#/definitions/pipeline_v1/ReportList",
            "description": "Report uploads reports at the the provided path(s)"
          },
          "script": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Script runs command line scripts using the operating system's shell. Each script represents a new process and shell in the runner environment. Note that when you provide multi-line commands, each line runs in the same shell."
          },
          "shell": {
            "description": "Shell defines the shell of the step.",
            "enum": [
              "sh",
              "bash",
              "powershell",
              "pwsh",
              "python"
            ],
            "type": "string"
          },
          "splitting": {
            "$ref": "#/definitions/pipeline_v1/TestSplitting",
            "description": "Splitting configures the test splitting behavior."
          }
        },
        "type": "object",
        "x-go-file": "step_tester.go"
      },
      "Strategy": {
        "properties": {
          "fail-fast": {
            "description": "FailFast defines the how to handle stage or step failure. If true, all in-progress or pending stages or steps are cancelled if any stage or step in the matrix fails.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "boolean"
          },
          "for": {
            "$ref": "#/definitions/pipeline_v1/For",
            "description": "For defines a for loop execution strategy."
          },
          "matrix": {
            "$ref": "#/definitions/pipeline_v1/Matrix",
            "description": "Matrix defines a matrix execution strategy."
          },
          "max-parallel": {
            "description": "MaxParallel defines the maximum number of parallel stages or steps.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "number"
          },
          "while": {
            "$ref": "#/definitions/pipeline_v1/While",
            "description": "While defines a while loop execution strategy."
          }
        },
        "type": "object",
        "x-go-file": "strategy.go"
      },
      "Template": {
        "description": "Template defines a Pipeline, Stage or Step template.",
        "properties": {
          "inputs": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Input"
            },
            "type": "object"
          },
          "stage": {
            "$ref": "#/definitions/pipeline_v1/Stage"
          },
          "step": {
            "$ref": "#/definitions/pipeline_v1/Step"
          }
        },
        "type": "object",
        "x-go-file": "template.go"
      },
      "TestIntelligence": {
        "properties": {
          "disabled": {
            "type": "boolean"
          }
        },
        "type": "object"
      },
      "TestSplitting": {
        "properties": {
          "concurrency": {
            "type": "number"
          },
          "disabled": {
            "type": "boolean"
          }
        },
        "type": "object"
      },
      "Volume": {
        "properties": {
          "name": {
            "type": "string"
          },
          "uses": {
            "enum": [
              "bind",
              "claim",
              "config",
              "temp"
            ],
            "type": "string"
          },
          "with": {
            "anyOf": [
              {
                "$ref": "#/definitions/pipeline_v1/VolumeBind"
              },
              {
                "$ref": "#/definitions/pipeline_v1/VolumeClaim"
              },
              {
                "$ref": "#/definitions/pipeline_v1/VolumeConfigMap"
              },
              {
                "$ref": "#/definitions/pipeline_v1/VolumeTemp"
              }
            ]
          }
        },
        "required": [
          "name",
          "uses"
        ],
        "type": "object"
      },
      "VolumeBind": {
        "properties": {
          "path": {
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "volume_bind.go"
      },
      "VolumeClaim": {
        "properties": {
          "name": {
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "volume_claim.go"
      },
      "VolumeConfigMap": {
        "properties": {
          "mode": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "optional": {
            "type": "boolean"
          }
        },
        "type": "object",
        "x-go-file": "volume_config_map.go"
      },
      "VolumeTemp": {
        "properties": {
          "limit": {
            "type": [
              "string",
              "number"
            ]
          },
          "medium": {
            "const": "memory",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "volume_temp.go"
      },
      "While": {
        "description": "While defines a while loop execution strategy.",
        "properties": {
          "condition": {
            "description": "Condition defines the while condition.",
            "type": "string"
          },
          "iterations": {
            "description": "Iterations defines maximum number of interations.",
            "type": "number"
          }
        },
        "type": "object",
        "x-go-file": "strategy_while.go"
      },
      "Workspace": {
        "anyOf": [
          {
            "type": "boolean"
          },
          {
            "$ref": "#/definitions/pipeline_v1/WorkspaceLong"
          }
        ]
      },
      "WorkspaceLong": {
        "properties": {
          "disabled": {
            "type": "boolean"
          },
          "path": {
            "type": "string"
          }
        },
        "type": "object"
      },
      "pipeline_v1": {
        "properties": {
          "barriers": {
            "description": "Barriers provides optional pipeline barriers.",
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "clone": {
            "$ref": "#/definitions/pipeline_v1/Clone",
            "description": "Clone overrides the default clone behavior."
          },
          "concurrency": {
            "$ref": "#/definitions/pipeline_v1/Concurrency",
            "description": "Concurrency groups provide a way to limit concurrency execution of pipelines that share the same concurrency key."
          },
          "default": {},
          "delegate": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "items": {
                  "type": "string"
                },
                "type": "array"
              }
            ],
            "description": "Delegage defines the default delegate that should handle stage execution. This is optional."
          },
          "env": {
            "additionalProperties": {
              "type": "string"
            },
            "description": "Env provides global environment variables that propagate to all pipeline steps.",
            "type": "object"
          },
          "environment": {
            "$ref": "#/definitions/pipeline_v1/EnvironmentRef",
            "description": "Environment defines the target deployment environment (e.g. development, prod)."
          },
          "generate": {
            "$ref": "#/definitions/pipeline_v1/Stage",
            "description": "Generate defines custom logic to dynamically generate a pipeline."
          },
          "id": {
            "deprecated": true,
            "description": "Id provides a unique pipeline identifer.",
            "type": "string"
          },
          "if": {
            "description": "If provides conditional pipeline execution logic. If the condition resolves to false, the pipeline is skipped.",
            "type": "string"
          },
          "inputs": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Input"
            },
            "description": "Inputs provides pipeline input variables.",
            "type": "object"
          },
          "jobs": {
            "additionalProperties": {
              "$ref": "#/definitions/pipeline_v1/Stage"
            },
            "description": "Jobs defines jobs (stages) in the pipeline.\n\nThis property is available solely for the purpose of backward compatibility with GitHub Actions.",
            "type": "object"
          },
          "name": {
            "deprecated": true,
            "description": "Name provides a pipeline name.",
            "type": "string"
          },
          "on": {
            "$ref": "#/definitions/pipeline_v1/On",
            "description": "On provides condition pipeline execution logic based on trigger event and action mapping. If the conditional logic resolves to folse, the pipeline is skipped."
          },
          "permissions": {
            "$ref": "#/definitions/pipeline_v1/Permissions"
          },
          "repo": {
            "$ref": "#/definitions/pipeline_v1/Repository",
            "description": "Repo overrides the default repository."
          },
          "service": {
            "$ref": "#/definitions/pipeline_v1/ServiceRef",
            "description": "Service defines the service being deployed."
          },
          "stages": {
            "description": "Stages provides a list of stages. Each pipeline is made up of one or more stages that executes sequentially.",
            "items": {
              "$ref": "#/definitions/pipeline_v1/Stage"
            },
            "type": "array"
          },
          "status": {
            "$ref": "#/definitions/pipeline_v1/Status",
            "description": "Status overrides the default status behavior."
          },
          "timeout": {
            "description": "Timeout defines the step timeout duration.",
            "format": "duration",
            "type": "string"
          }
        },
        "type": "object",
        "x-go-file": "pipeline.go"
      }
    }
  }
};
export default schema;
