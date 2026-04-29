// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v1/trigger.json
// @ts-nocheck

const schema: Record<string, any> = {
  "type": "object",
  "title": "trigger_v1",
  "required": [
    "spec",
    "version",
    "kind"
  ],
  "properties": {
    "version": {
      "description": "Version defines the schema version.",
      "type": "number",
      "enum": [
        1
      ]
    },
    "kind": {
      "description": "defines the kind of yaml (pipeline/template/trigger)",
      "type": "string",
      "enum": [
        "trigger"
      ]
    },
    "spec": {
      "$ref": "#/definitions/trigger_v1/trigger_source"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "pipeline": {
      "numberVariable": {
        "title": "numberVariable",
        "type": "object",
        "required": [
          "value"
        ],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$]{0,63}$"
          },
          "default": {
            "type": "number",
            "format": "double"
          },
          "type": {
            "type": "string",
            "enum": [
              "Number"
            ]
          },
          "value": {
            "oneOf": [
              {
                "type": "number",
                "format": "double"
              },
              {
                "type": "string",
                "pattern": "((^[+-]?[0-9]*\\.?[0-9]+$)|(<\\+.+>.*))"
              }
            ]
          },
          "description": {
            "type": "string"
          },
          "required": {
            "type": "boolean"
          },
          "metadata": {
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "secretVariable": {
        "title": "secretVariable",
        "type": "object",
        "required": [
          "value"
        ],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$]{0,63}$"
          },
          "default": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "Secret"
            ]
          },
          "value": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "required": {
            "type": "boolean"
          },
          "metadata": {
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "stringVariable": {
        "title": "stringVariable",
        "type": "object",
        "required": [
          "value"
        ],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$]{0,63}$"
          },
          "default": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "String"
            ]
          },
          "value": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "required": {
            "type": "boolean"
          },
          "metadata": {
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    },
    "trigger_v1": {
      "trigger_source": {
        "title": "trigger_source",
        "type": "object",
        "required": [
          "type",
          "spec"
        ],
        "properties": {
          "input_set_refs": {
            "oneOf": [
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              {
                "type": "string",
                "pattern": "(<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "inputs": {
            "description": "input yaml for the pipeline",
            "type": "string"
          },
          "execute_stages": {
            "description": "stage identifiers of the stages to be executed in the pipeline",
            "oneOf": [
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              {
                "type": "string",
                "pattern": "(<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "interval": {
            "description": "polling interval",
            "type": "string",
            "pattern": "(((([1-9])+\\d*[mh])+(\\s/?\\d+[mh])*)|(^$)|(0))$"
          },
          "type": {
            "type": "string",
            "enum": [
              "webhook",
              "artifact",
              "manifest",
              "scheduled",
              "multi-region-artifact",
              "system-event"
            ]
          },
          "webhook": {
            "description": "webhook identifier",
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#",
        "allOf": [
          {
            "if": {
              "properties": {
                "type": {
                  "const": "artifact"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger_v1/trigger_type/artifact_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "manifest"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger_v1/trigger_type/manifest_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "multi-region-artifact"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger_v1/trigger_type/multi_region_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "scheduled"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger_v1/trigger_type/scheduled_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "webhook"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger_v1/trigger_type/webhook_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "system-event"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger_v1/trigger_type/system_event_trigger"
                }
              }
            }
          }
        ]
      },
      "trigger_type": {
        "artifact_trigger": {
          "title": "artifact_trigger",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "gcr",
                    "ecr",
                    "docker-registry",
                    "nexus3-registry",
                    "nexus2-registry",
                    "artifactory-registry",
                    "acr",
                    "amazon-s3",
                    "jenkins",
                    "custom",
                    "google-artifact-registry",
                    "github-package-registry",
                    "azure",
                    "amazon-machine-image",
                    "google-cloud-storage",
                    "bamboo"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "acr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/acr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "amazon-machine-image"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/ami_registry_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "amazon-s3"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/amazon_s3_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "artifactory-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/artifactory_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "azure"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/azure_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "bamboo"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/bamboo"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "custom"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/custom_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "docker-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/docker_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "ecr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/ecr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "gcr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/gcr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "github-package-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/github_packages"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "google-artifact-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/gar_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "google-cloud-storage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/google_cloud"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "jenkins"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/jenkins_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "nexus2-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/nexus"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "nexus3-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/nexus_registry"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "manifest_trigger": {
          "title": "manifest_trigger",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "helm-chart"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "helm-chart"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/manifest_trigger/helm_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "multi_region_trigger": {
          "title": "multi_region_trigger",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "sources"
              ],
              "properties": {
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "sources": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger_v1/multi_region_artifact/artifact_type_spec_wrapper"
                  }
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "gcr",
                    "ecr",
                    "docker-registry",
                    "nexus3-registry",
                    "nexus2-registry",
                    "artifactory-registry",
                    "acr",
                    "amazon-s3",
                    "jenkins",
                    "custom",
                    "google-artifact-registry",
                    "github-package-registry",
                    "azure",
                    "amazon-machine-image",
                    "google-cloud-storage",
                    "bamboo"
                  ]
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "scheduled_trigger": {
          "title": "scheduled_trigger",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string"
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "cron"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/scheduled_trigger/cron_trigger_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "webhook_trigger": {
          "title": "webhook_trigger",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "azure-repo",
                    "github",
                    "gitlab",
                    "bitbucket",
                    "custom",
                    "aws-code-commit",
                    "harness"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "aws-code-commit"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/aws_commit_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "azure-repo"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_repo_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "bitbucket"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "custom"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/custom_trigger_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "github"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "gitlab"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "harness"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "system_event_trigger": {
          "title": "system_event_trigger",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "pipeline"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "pipeline"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/system_event_trigger/pipeline_system_event_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "trigger_spec": {
        "title": "trigger_spec",
        "type": "object",
        "discriminator": "type",
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "artifact_trigger": {
        "acr_spec": {
          "title": "acr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "registry": {
                  "type": "string"
                },
                "repo": {
                  "type": "string"
                },
                "subscription": {
                  "description": "subscription identifier",
                  "type": "string"
                },
                "tag": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "artifact_type_spec": {
          "title": "artifact_type_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "conditions": {
          "title": "conditions",
          "description": "conditions for artifact trigger",
          "properties": {
            "event": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/trigger_v1/trigger_event_data"
              }
            },
            "jexl": {
              "type": "string"
            },
            "metadata": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/trigger_v1/trigger_event_data"
              }
            }
          }
        },
        "ami_registry_spec": {
          "title": "ami_registry_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "filters": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/ami_filter"
                  }
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "region": {
                  "type": "string"
                },
                "tags": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/ami_tag"
                  }
                },
                "version": {
                  "type": "string"
                },
                "version_regex": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ami_filter": {
          "title": "ami_filter",
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "value": {
              "type": "string"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ami_tag": {
          "title": "ami_tag",
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "value": {
              "type": "string"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "amazon_s3_registry": {
          "title": "amazon_s3_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "bucket": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "path_regex": {
                  "type": "string"
                },
                "region": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "artifactory_registry": {
          "title": "artifactory_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "dir": {
                  "type": "string"
                },
                "filter": {
                  "type": "string"
                },
                "path": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "repo": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact repository details"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "artifact repository details": {
          "title": "artifact repository details",
          "properties": {
            "name": {
              "type": "string"
            },
            "format": {
              "type": "string"
            },
            "url": {
              "type": "string"
            }
          }
        },
        "azure_artifact": {
          "title": "azure_artifact",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "feed": {
                  "type": "string"
                },
                "pkg": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/Package details"
                },
                "project": {
                  "type": "string"
                },
                "version": {
                  "type": "string"
                },
                "version_regex": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "Package details": {
          "title": "Package details",
          "properties": {
            "name": {
              "type": "string",
              "description": "package name"
            },
            "type": {
              "type": "string",
              "description": "package type"
            }
          }
        },
        "bamboo": {
          "title": "bamboo",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "paths": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "build": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "plan_key": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "custom_artifact": {
          "title": "custom_artifact",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "inputs": {
                  "type": "array",
                  "items": {
                    "oneOf": [
                      {
                        "$ref": "#/definitions/pipeline/numberVariable"
                      },
                      {
                        "$ref": "#/definitions/pipeline/secretVariable"
                      },
                      {
                        "$ref": "#/definitions/pipeline/stringVariable"
                      }
                    ]
                  }
                },
                "metadata": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                "script": {
                  "type": "string"
                },
                "version": {
                  "type": "string"
                },
                "version_path": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "docker_registry": {
          "title": "docker_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "location": {
                  "description": "image path and tag, format-> image_path:tag",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ecr": {
          "title": "ecr",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "region": {
                  "type": "string"
                },
                "registry": {
                  "description": "registry identifier",
                  "type": "string"
                },
                "location": {
                  "type": "string",
                  "description": "image path and tag, format-> image_path:tag"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gcr": {
          "title": "gcr",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "location": {
                  "type": "string",
                  "description": "image path and tag, format-> image_path:tag"
                },
                "host": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_packages": {
          "title": "github_packages",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "org": {
                  "type": "string"
                },
                "pkg": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/Package details"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gar_spec": {
          "title": "gar_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "pkg": {
                  "type": "string"
                },
                "project": {
                  "type": "string"
                },
                "region": {
                  "type": "string"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                },
                "version": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "google_cloud": {
          "title": "google_cloud",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string"
                },
                "bucket": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "project": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "jenkins_registry": {
          "title": "jenkins_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string"
                },
                "build": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "job": {
                  "description": "job name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "nexus": {
          "title": "nexus",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifact": {
                  "description": "artifact identifier",
                  "type": "string"
                },
                "classifier": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "extension": {
                  "type": "string"
                },
                "group_id": {
                  "type": "string"
                },
                "pkg": {
                  "description": "package name",
                  "type": "string"
                },
                "repo": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact repository details"
                },
                "tag": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "nexus_registry": {
          "title": "nexus_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifact": {
                  "description": "artifact identifier",
                  "type": "string"
                },
                "classifier": {
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                },
                "extension": {
                  "type": "string"
                },
                "group": {
                  "type": "string"
                },
                "group_id": {
                  "type": "string"
                },
                "location": {
                  "type": "string",
                  "description": "image path and tag, format-> image_path:tag"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/conditions"
                },
                "pkg": {
                  "description": "package name",
                  "type": "string"
                },
                "repo": {
                  "$ref": "#/definitions/trigger_v1/artifact_trigger/artifact repository details"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "trigger_event_data": {
        "title": "trigger_event_data",
        "type": "object",
        "properties": {
          "key": {
            "type": "string"
          },
          "operator": {
            "type": "string",
            "enum": [
              "in",
              "equals",
              "not-equals",
              "not-in",
              "regex",
              "ends-with",
              "starts-with",
              "contains",
              "does-not-contain"
            ]
          },
          "value": {
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "manifest_trigger": {
        "helm_spec": {
          "title": "helm_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/manifest_trigger/manifest_spec"
            },
            {
              "type": "object",
              "properties": {
                "chart": {
                  "description": "chart details, format-> chart_name@version",
                  "type": "string"
                },
                "event_conditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger_v1/trigger_event_data"
                  }
                },
                "helm_version": {
                  "type": "string",
                  "enum": [
                    "v2",
                    "v3",
                    "v380"
                  ]
                },
                "store": {
                  "$ref": "#/definitions/trigger_v1/manifest_trigger/build_store"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "manifest_spec": {
          "title": "manifest_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "build_store": {
          "title": "build_store",
          "type": "object",
          "required": [
            "type",
            "spec"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "http",
                "s3",
                "gcs"
              ]
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#",
          "allOf": [
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "gcs"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/manifest_trigger/gcs_build_store_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "http"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/manifest_trigger/http_build_store_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "s3"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/manifest_trigger/s3_build_store_spec"
                  }
                }
              }
            }
          ]
        },
        "gcs_build_store_spec": {
          "title": "gcs_build_store_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/manifest_trigger/build_store_spec"
            },
            {
              "type": "object",
              "properties": {
                "location": {
                  "description": "bucket name and path to the manifest folder, format-> bucket_name:folder_path",
                  "type": "string"
                },
                "connector": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "build_store_spec": {
          "title": "build_store_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "http_build_store_spec": {
          "title": "http_build_store_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/manifest_trigger/build_store_spec"
            },
            {
              "type": "object",
              "properties": {
                "connector": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "s3_build_store_spec": {
          "title": "s3_build_store_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/manifest_trigger/build_store_spec"
            },
            {
              "type": "object",
              "properties": {
                "location": {
                  "description": "bucket name and path to the manifest folder, format-> bucket_name:folder_path"
                },
                "connector": {
                  "type": "string"
                },
                "region": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "multi_region_artifact": {
        "artifact_type_spec_wrapper": {
          "title": "artifact_type_spec_wrapper",
          "type": "object",
          "properties": {},
          "required": [
            "type",
            "spec"
          ],
          "$schema": "http://json-schema.org/draft-07/schema#",
          "allOf": [
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "acr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/acr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "amazon-machine-image"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/ami_registry_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "amazon-s3"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/amazon_s3_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "artifactory-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/artifactory_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "azure"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/azure_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "bamboo"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/bamboo"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "custom"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/custom_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "docker-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/docker_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "ecr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/ecr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "gcr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/gcr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "github-package-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/github_packages"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "google-artifact-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/gar_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "google-cloud-storage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/google_cloud"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "jenkins"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/jenkins_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "nexus2-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/nexus"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "nexus3-registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/artifact_trigger/nexus_registry"
                  }
                }
              }
            }
          ]
        }
      },
      "scheduled_trigger": {
        "cron_trigger_spec": {
          "title": "cron_trigger_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/scheduled_trigger/scheduled_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "expression"
              ],
              "properties": {
                "expression": {
                  "type": "string"
                },
                "type": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "scheduled_trigger_spec": {
          "title": "scheduled_trigger_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "webhook_trigger": {
        "aws_commit_spec": {
          "title": "aws_commit_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "push"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/aws_commit_push_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "webhook_trigger_spec": {
          "title": "webhook_trigger_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "aws_commit_push_spec": {
          "title": "aws_commit_push_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/aws_commit_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "jexl": {
                    "type": "string"
                  },
                  "payload": {
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/trigger_v1/trigger_event_data"
                    }
                  }
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "aws_commit_event_spec": {
          "title": "aws_commit_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "azure_repo_spec": {
          "title": "azure_repo_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "pr",
                    "push",
                    "issue-comment"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "issue-comment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_issue_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "pr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_repo_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_repo_push_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "azure_issue_comment_spec": {
          "title": "azure_issue_comment_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_repo_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "edit",
                      "delete"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "azure_repo_event_spec": {
          "title": "azure_repo_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "conditions": {
          "title": "conditions",
          "description": "conditions for webhook trigger",
          "properties": {
            "header": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/trigger_v1/trigger_event_data"
              }
            },
            "jexl": {
              "type": "string"
            },
            "payload": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/trigger_v1/trigger_event_data"
              }
            }
          }
        },
        "azure_repo_pr_spec": {
          "title": "azure_repo_pr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_repo_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "update",
                      "merge"
                    ]
                  }
                },
                "abort_previous": {
                  "description": "abort previous executions",
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "azure_repo_push_spec": {
          "title": "azure_repo_push_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/azure_repo_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "bitbucket_spec": {
          "title": "bitbucket_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "pr",
                    "push",
                    "pr-comment"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "pr-comment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_pr_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "pr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_push_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "bitbucket_pr_comment_spec": {
          "title": "bitbucket_pr_comment_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "edit",
                      "delete"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "bitbucket_event_spec": {
          "title": "bitbucket_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "bitbucket_pr_spec": {
          "title": "bitbucket_pr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "update",
                      "merge",
                      "decline"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "bitbucket_push_spec": {
          "title": "bitbucket_push_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/bitbucket_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "custom_trigger_spec": {
          "title": "custom_trigger_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_spec": {
          "title": "github_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "pr",
                    "push",
                    "issue-comment",
                    "release",
                    "delete",
                    "create"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "issue-comment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_issue_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "pr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_push_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "release"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_release_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "delete"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_delete_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "create"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/github_create_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_issue_comment_spec": {
          "title": "github_issue_comment_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "edit",
                      "delete"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_event_spec": {
          "title": "github_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_pr_spec": {
          "title": "github_pr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "close",
                      "edit",
                      "open",
                      "reopen",
                      "label",
                      "unlabel",
                      "sync",
                      "ready-for-review"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_push_spec": {
          "title": "github_push_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_release_spec": {
          "title": "github_release_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "edit",
                      "delete",
                      "pre-release",
                      "publish",
                      "release",
                      "unpublish"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_delete_spec": {
          "title": "github_delete_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "github_create_spec": {
          "title": "github_create_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_spec": {
          "title": "gitlab_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "mr",
                    "push",
                    "mr-comment",
                    "tag"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "mr-comment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_mr_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "mr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_push_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "tag"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_tag_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_mr_comment_spec": {
          "title": "gitlab_mr_comment_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_event_spec": {
          "title": "gitlab_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_pr_spec": {
          "title": "gitlab_pr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions",
                "connector"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "open",
                      "close",
                      "reopen",
                      "merge",
                      "update",
                      "sync"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_push_spec": {
          "title": "gitlab_push_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_tag_spec": {
          "title": "gitlab_tag_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "required": [
                "connector"
              ],
              "properties": {
                "abort_previous": {
                  "type": "boolean"
                },
                "connector": {
                  "type": "string"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_spec": {
          "title": "harness_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "required": [
                "type",
                "spec"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "pr",
                    "push",
                    "branch",
                    "tag"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "pr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_push_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "branch"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "tag"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_pr_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_pr_spec": {
          "title": "harness_pr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_event_spec"
            },
            {
              "type": "object",
              "required": [
                "actions"
              ],
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "create",
                      "update",
                      "reopen",
                      "merge",
                      "comment"
                    ]
                  }
                },
                "abort_previous": {
                  "type": "boolean"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_event_spec": {
          "title": "harness_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_push_spec": {
          "title": "harness_push_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger_v1/webhook_trigger/harness_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "abort_previous": {
                  "type": "boolean"
                },
                "conditions": {
                  "$ref": "#/definitions/trigger_v1/webhook_trigger/conditions"
                },
                "repo": {
                  "description": "repository name",
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "system_event_trigger": {
        "pipeline_system_event_spec": {
          "title": "pipeline_system_event_spec",
          "type": "object",
          "required": [
            "eventType"
          ],
          "properties": {
            "eventType": {
              "description": "The pipeline event type to react to",
              "type": "string",
              "enum": [
                "pipeline-success",
                "pipeline-failure"
              ]
            },
            "payloadConditions": {
              "description": "Optional conditions on the event payload. Supported key is \"sourcePipeline\". Empty list matches any source pipeline.",
              "type": "array",
              "items": {
                "$ref": "#/definitions/trigger_v1/trigger_event_data"
              }
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      }
    }
  }
};
export default schema;
