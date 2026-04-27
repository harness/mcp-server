// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v0/trigger.json
// @ts-nocheck

const schema: Record<string, any> = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "trigger",
  "required": [
    "trigger"
  ],
  "properties": {
    "trigger": {
      "$ref": "#/definitions/trigger/trigger"
    }
  },
  "definitions": {
    "trigger": {
      "trigger": {
        "type": "object",
        "title": "trigger",
        "required": [
          "identifier",
          "orgIdentifier",
          "projectIdentifier"
        ],
        "properties": {
          "description": {
            "type": "string"
          },
          "enabled": {
            "type": "boolean"
          },
          "encryptedWebhookSecretIdentifier": {
            "type": "string"
          },
          "identifier": {
            "type": "string",
            "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
          },
          "inputSetRefs": {
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
          "inputYaml": {
            "type": "string"
          },
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z_0-9-.][-0-9a-zA-Z_\\s.]{0,127}$"
          },
          "orgIdentifier": {
            "type": "string"
          },
          "pipelineBranchName": {
            "type": "string"
          },
          "pipelineIdentifier": {
            "type": "string"
          },
          "projectIdentifier": {
            "type": "string"
          },
          "source": {
            "$ref": "#/definitions/trigger/trigger_source"
          },
          "stagesToExecute": {
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
          "tags": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "trigger_source": {
        "title": "trigger_source",
        "type": "object",
        "properties": {
          "pollInterval": {
            "type": "string",
            "pattern": "(((([1-9])+\\d*[mh])+(\\s/?\\d+[mh])*)|(^$)|(0))$"
          },
          "type": {
            "type": "string",
            "enum": [
              "Webhook",
              "Artifact",
              "Manifest",
              "Scheduled",
              "MultiRegionArtifact",
              "SystemEvent"
            ]
          },
          "webhookId": {
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#",
        "allOf": [
          {
            "if": {
              "properties": {
                "type": {
                  "const": "Artifact"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger/trigger_type/artifact_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "Manifest"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger/trigger_type/manifest_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "MultiRegionArtifact"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger/trigger_type/multi_region_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "Scheduled"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger/trigger_type/scheduled_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "Webhook"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger/trigger_type/webhook_trigger"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "type": {
                  "const": "SystemEvent"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/trigger/trigger_type/system_event_trigger"
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
              "$ref": "#/definitions/trigger/trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactRef": {
                  "type": "string"
                },
                "stageIdentifier": {
                  "type": "string"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "Gcr",
                    "Ecr",
                    "DockerRegistry",
                    "Nexus3Registry",
                    "Nexus2Registry",
                    "ArtifactoryRegistry",
                    "Acr",
                    "AmazonS3",
                    "Jenkins",
                    "CustomArtifact",
                    "GoogleArtifactRegistry",
                    "GithubPackageRegistry",
                    "AzureArtifacts",
                    "AmazonMachineImage",
                    "GoogleCloudStorage",
                    "GceImage",
                    "Bamboo"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Acr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/acr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AmazonMachineImage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/ami_registry_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AmazonS3"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/amazon_s3_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "ArtifactoryRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/artifactory_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AzureArtifacts"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/azure_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Bamboo"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/bamboo"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "CustomArtifact"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/custom_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "DockerRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/docker_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Ecr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/ecr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Gcr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gcr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GithubPackageRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/github_packages"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GoogleArtifactRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gar_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GoogleCloudStorage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/google_cloud"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GceImage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gce_image_registry_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Jenkins"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/jenkins_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Nexus2Registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/nexus"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Nexus3Registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/nexus_registry"
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
              "$ref": "#/definitions/trigger/trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "manifestRef": {
                  "type": "string"
                },
                "stageIdentifier": {
                  "type": "string"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "HelmChart"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "HelmChart"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/manifest_trigger/helm_spec"
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
              "$ref": "#/definitions/trigger/trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "sources": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/multi_region_artifact/artifact_type_spec_wrapper"
                  }
                },
                "stageIdentifier": {
                  "type": "string"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "Gcr",
                    "Ecr",
                    "DockerRegistry",
                    "Nexus3Registry",
                    "Nexus2Registry",
                    "ArtifactoryRegistry",
                    "Acr",
                    "AmazonS3",
                    "Jenkins",
                    "CustomArtifact",
                    "GoogleArtifactRegistry",
                    "GithubPackageRegistry",
                    "AzureArtifacts",
                    "AmazonMachineImage",
                    "GoogleCloudStorage",
                    "Bamboo"
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
              "$ref": "#/definitions/trigger/trigger_spec"
            },
            {
              "type": "object",
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
                    "const": "Cron"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/scheduled_trigger/cron_trigger_spec"
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
              "$ref": "#/definitions/trigger/trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "Pipeline"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Pipeline"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/system_event_trigger/pipeline_system_event_spec"
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
              "$ref": "#/definitions/trigger/trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "AzureRepo",
                    "Github",
                    "Gitlab",
                    "Bitbucket",
                    "Custom",
                    "AwsCodeCommit",
                    "Harness",
                    "EventRelay",
                    "HarnessArtifactRegistry"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AwsCodeCommit"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/aws_commit_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AzureRepo"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/azure_repo_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Bitbucket"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Custom"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/custom_trigger_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Github"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Gitlab"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/gitlab_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Harness"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/harness_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "EventRelay"
                  }
                },
                "then": {
                  "properties": {
                    "spec": {
                      "$ref": "#/definitions/trigger/webhook_trigger/event_bridge_spec"
                    }
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "HarnessArtifactRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/harness_artifact_registry_spec"
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "registry": {
                  "type": "string"
                },
                "repository": {
                  "type": "string"
                },
                "subscriptionId": {
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
        "ami_registry_spec": {
          "title": "ami_registry_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "filters": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/artifact_trigger/ami_filter"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "region": {
                  "type": "string"
                },
                "tags": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/artifact_trigger/ami_tag"
                  }
                },
                "version": {
                  "type": "string"
                },
                "versionRegex": {
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "bucketName": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "filePathRegex": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactDirectory": {
                  "type": "string"
                },
                "artifactFilter": {
                  "type": "string"
                },
                "artifactPath": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repository": {
                  "type": "string"
                },
                "repositoryFormat": {
                  "type": "string"
                },
                "repositoryUrl": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "azure_artifact": {
          "title": "azure_artifact",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "feed": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "packageName": {
                  "type": "string"
                },
                "packageType": {
                  "type": "string"
                },
                "project": {
                  "type": "string"
                },
                "version": {
                  "type": "string"
                },
                "versionRegex": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "bamboo": {
          "title": "bamboo",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactPaths": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "build": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "planKey": {
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactsArrayPath": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
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
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
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
                "versionPath": {
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "imagePath": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "tag": {
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "imagePath": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "region": {
                  "type": "string"
                },
                "registryId": {
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
        "gcr": {
          "title": "gcr",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "imagePath": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "registryHostname": {
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
        "github_packages": {
          "title": "github_packages",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "org": {
                  "type": "string"
                },
                "packageName": {
                  "type": "string"
                },
                "packageType": {
                  "type": "string"
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
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
                "repositoryName": {
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactPath": {
                  "type": "string"
                },
                "bucket": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "project": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gce_image_registry_spec": {
          "title": "gce_image_registry_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "filters": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gce_image_filter"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "labels": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gce_image_label"
                  }
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "project": {
                  "type": "string"
                },
                "version": {
                  "type": "string"
                },
                "versionRegex": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gce_image_filter": {
          "title": "gce_image_filter",
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
        "gce_image_label": {
          "title": "gce_image_label",
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
        "jenkins_registry": {
          "title": "jenkins_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactPath": {
                  "type": "string"
                },
                "build": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "jobName": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
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
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactId": {
                  "type": "string"
                },
                "classifier": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "extension": {
                  "type": "string"
                },
                "groupId": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "packageName": {
                  "type": "string"
                },
                "repositoryFormat": {
                  "type": "string"
                },
                "repositoryName": {
                  "type": "string"
                },
                "repositoryUrl": {
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
        "nexus_registry": {
          "title": "nexus_registry",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/artifact_trigger/artifact_type_spec"
            },
            {
              "type": "object",
              "properties": {
                "artifactId": {
                  "type": "string"
                },
                "classifier": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "extension": {
                  "type": "string"
                },
                "group": {
                  "type": "string"
                },
                "groupId": {
                  "type": "string"
                },
                "imagePath": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "metaDataConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "packageName": {
                  "type": "string"
                },
                "repository": {
                  "type": "string"
                },
                "repositoryFormat": {
                  "type": "string"
                },
                "repositoryUrl": {
                  "type": "string"
                },
                "tag": {
                  "type": "string"
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
              "In",
              "Equals",
              "NotEquals",
              "NotIn",
              "Regex",
              "EndsWith",
              "StartsWith",
              "Contains",
              "DoesNotContain"
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
              "$ref": "#/definitions/trigger/manifest_trigger/manifest_spec"
            },
            {
              "type": "object",
              "properties": {
                "chartName": {
                  "type": "string"
                },
                "chartVersion": {
                  "type": "string"
                },
                "eventConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "helmVersion": {
                  "type": "string",
                  "enum": [
                    "V2",
                    "V3",
                    "V380"
                  ]
                },
                "store": {
                  "$ref": "#/definitions/trigger/manifest_trigger/build_store"
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
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "Http",
                "S3",
                "Gcs"
              ]
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#",
          "allOf": [
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Gcs"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/manifest_trigger/gcs_build_store_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Http"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/manifest_trigger/http_build_store_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "S3"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/manifest_trigger/s3_build_store_spec"
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
              "$ref": "#/definitions/trigger/manifest_trigger/build_store_spec"
            },
            {
              "type": "object",
              "properties": {
                "bucketName": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "folderPath": {
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
              "$ref": "#/definitions/trigger/manifest_trigger/build_store_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
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
              "$ref": "#/definitions/trigger/manifest_trigger/build_store_spec"
            },
            {
              "type": "object",
              "properties": {
                "bucketName": {
                  "type": "string"
                },
                "connectorRef": {
                  "type": "string"
                },
                "folderPath": {
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
          "$schema": "http://json-schema.org/draft-07/schema#",
          "allOf": [
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Acr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/acr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AmazonMachineImage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/ami_registry_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AmazonS3"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/amazon_s3_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "ArtifactoryRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/artifactory_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "AzureArtifacts"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/azure_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Bamboo"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/bamboo"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "CustomArtifact"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/custom_artifact"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "DockerRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/docker_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Ecr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/ecr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Gcr"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gcr"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GithubPackageRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/github_packages"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GoogleArtifactRegistry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/gar_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "GoogleCloudStorage"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/google_cloud"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Jenkins"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/jenkins_registry"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Nexus2Registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/nexus"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Nexus3Registry"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/artifact_trigger/nexus_registry"
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
              "$ref": "#/definitions/trigger/scheduled_trigger/scheduled_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "expression": {
                  "type": "string"
                },
                "type": {
                  "type": "string"
                },
                "timezone": {
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
      "system_event_trigger": {
        "pipeline_system_event_spec": {
          "title": "pipeline_system_event_spec",
          "type": "object",
          "properties": {
            "eventType": {
              "type": "string",
              "enum": [
                "PipelineFailure",
                "PipelineSuccess"
              ]
            },
            "payloadConditions": {
              "type": "array",
              "description": "Optional conditions on the event payload. Supported key: 'sourcePipeline'. Supports all operators: equals, not-equals, in, not-in, regex, starts-with, ends-with, contains, does-not-contain. ALL conditions must pass. Empty list = match any source pipeline.",
              "items": {
                "type": "object",
                "required": [
                  "key",
                  "operator",
                  "value"
                ],
                "properties": {
                  "key": {
                    "type": "string",
                    "description": "The field to evaluate. Supported value: 'sourcePipeline'."
                  },
                  "operator": {
                    "type": "string",
                    "enum": [
                      "equals",
                      "not-equals",
                      "in",
                      "not-in",
                      "regex",
                      "starts-with",
                      "ends-with",
                      "contains",
                      "does-not-contain"
                    ],
                    "description": "The comparison operator."
                  },
                  "value": {
                    "type": "string",
                    "description": "The value to compare against."
                  }
                }
              }
            }
          },
          "required": [
            "eventType"
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "webhook_trigger": {
        "aws_commit_spec": {
          "title": "aws_commit_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "Push"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/aws_commit_push_spec"
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
              "$ref": "#/definitions/trigger/webhook_trigger/aws_commit_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "PullRequest",
                    "Push",
                    "IssueComment"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "IssueComment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/azure_issue_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "PullRequest"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/azure_repo_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/azure_repo_push_spec"
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
              "$ref": "#/definitions/trigger/webhook_trigger/azure_repo_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Edit",
                      "Delete"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
        "azure_repo_pr_spec": {
          "title": "azure_repo_pr_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/azure_repo_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Update",
                      "Merge"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/azure_repo_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "PullRequest",
                    "Push",
                    "PRComment"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "PRComment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_pr_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "PullRequest"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_push_spec"
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
              "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Edit",
                      "Delete"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Update",
                      "Merge",
                      "Decline"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/bitbucket_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
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
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "PullRequest",
                    "Push",
                    "IssueComment",
                    "Release",
                    "Delete",
                    "Create"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "IssueComment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_issue_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "PullRequest"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_push_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Release"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_release_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Delete"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_delete_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Create"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/github_create_spec"
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
              "$ref": "#/definitions/trigger/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Edit",
                      "Delete"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Close",
                      "Edit",
                      "Open",
                      "Reopen",
                      "Label",
                      "Unlabel",
                      "Synchronize",
                      "ReadyForReview"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Edit",
                      "Delete",
                      "Prerelease",
                      "Publish",
                      "Release",
                      "Unpublish"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/github_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "MergeRequest",
                    "Push",
                    "MRComment",
                    "Tag",
                    "PipelineHook"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "MRComment"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/gitlab_mr_comment_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "MergeRequest"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/gitlab_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/gitlab_push_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Tag"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/gitlab_tag_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "PipelineHook"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/gitlab_pipeline_hook_spec"
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
              "$ref": "#/definitions/trigger/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Open",
                      "Close",
                      "Reopen",
                      "Merge",
                      "Update",
                      "Sync"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "gitlab_pipeline_hook_spec": {
          "title": "gitlab_pipeline_hook_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/gitlab_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "connectorRef": {
                  "type": "string"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "PullRequest",
                    "Push",
                    "Branch",
                    "Tag"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "PullRequest"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/harness_pr_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Push"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/harness_push_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Branch"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/harness_branch_spec"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Tag"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/harness_tag_spec"
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
              "$ref": "#/definitions/trigger/webhook_trigger/harness_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Update",
                      "Reopen",
                      "Merge",
                      "Comment"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
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
              "$ref": "#/definitions/trigger/webhook_trigger/harness_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_branch_spec": {
          "title": "harness_branch_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/harness_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Delete"
                    ]
                  }
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_tag_spec": {
          "title": "harness_tag_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/harness_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Create",
                      "Delete"
                    ]
                  }
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "repoName": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "event_bridge_spec": {
          "title": "event_bridge_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "webhookIdentifier": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "harness_artifact_registry_spec": {
          "title": "harness_artifact_registry_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/webhook_trigger_spec"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "Artifact"
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "type": {
                    "const": "Artifact"
                  }
                }
              },
              "then": {
                "properties": {
                  "spec": {
                    "$ref": "#/definitions/trigger/webhook_trigger/har_artifact_spec"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "har_artifact_spec": {
          "title": "har_artifact_spec",
          "allOf": [
            {
              "$ref": "#/definitions/trigger/webhook_trigger/har_event_spec"
            },
            {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "ArtifactCreation",
                      "ArtifactDeletion"
                    ]
                  }
                },
                "autoAbortPreviousExecutions": {
                  "type": "boolean"
                },
                "headerConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "jexlCondition": {
                  "type": "string"
                },
                "payloadConditions": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/trigger/trigger_event_data"
                  }
                },
                "registryName": {
                  "type": "string"
                }
              },
              "required": [
                "registryName"
              ]
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "har_event_spec": {
          "title": "har_event_spec",
          "type": "object",
          "discriminator": "type",
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      }
    },
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
    }
  }
};
export default schema;
