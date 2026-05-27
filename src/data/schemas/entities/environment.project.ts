// Auto-generated — do not edit manually. Run `pnpm sync-entity-schemas` to regenerate.
// @ts-nocheck
// Synced: 2026-05-27T09:53:36.734Z | entity=environment | scope=project

const schema: Record<string, any> = {
  "type": "object",
  "properties": {
    "environment": {
      "$ref": "#/definitions/NGEnvironmentInfoConfig"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "ApplicationSettingsConfiguration": {
      "type": "object",
      "required": [
        "store"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "store": {
          "$ref": "#/definitions/StoreConfigWrapper"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactBundleStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "artifactBundleType",
            "deployableUnitPath",
            "manifestPath"
          ],
          "properties": {
            "artifactBundleType": {
              "type": "string",
              "enum": [
                "ZIP",
                "TAR",
                "TAR_GZIP"
              ]
            },
            "deployableUnitPath": {
              "type": "string"
            },
            "manifestPath": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactoryStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "repositoryName"
          ],
          "properties": {
            "artifactPaths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "repositoryName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AsgAdditionalConfigurationManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AsgConfigurationManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AsgLaunchTemplateManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AsgScalingPolicyManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AsgScheduledUpdateGroupActionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AutoScalerManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "skipResourceVersioning": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsLambdaDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsLambdaFunctionAliasDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSamDirectoryManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "samTemplateFile": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureContainerAppsConfigurationManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
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
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
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
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConfigFile": {
      "type": "object",
      "required": [
        "identifier",
        "spec"
      ],
      "properties": {
        "identifier": {
          "type": "string"
        },
        "spec": {
          "$ref": "#/definitions/ConfigFileAttributes"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConfigFileAttributes": {
      "type": "object",
      "required": [
        "store"
      ],
      "properties": {
        "store": {
          "$ref": "#/definitions/StoreConfigWrapper"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConfigFileWrapper": {
      "type": "object",
      "properties": {
        "configFile": {
          "$ref": "#/definitions/ConfigFile"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConnectionStringsConfiguration": {
      "type": "object",
      "required": [
        "store"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "store": {
          "$ref": "#/definitions/StoreConfigWrapper"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomRemoteStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "extractionScript",
            "filePath"
          ],
          "properties": {
            "delegateSelectors": {
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
            "extractionScript": {
              "type": "string"
            },
            "filePath": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcsScalableTargetDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcsScalingPolicyDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcsScheduledActionDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcsServiceDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcsTaskDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcsStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
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
            "manifestPath": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitLabStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
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
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitOpsDeploymentRepoManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
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
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
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
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleCloudFunctionDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleCloudFunctionGenOneDefinitionManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleCloudRunJobManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleCloudRunServiceManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleMigAutoscalerConfigurationManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleMigConfigurationManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleMigHealthCheckConfigurationManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleMigInstanceTemplateManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessCodeStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "$ref": "#/definitions/ParameterFieldString"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
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
            "repoName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "files": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "secretFiles": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HelmChartManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
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
            "commandFlags": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/HelmManifestCommandFlag"
              }
            },
            "enableDeclarativeRollback": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "fetchHelmChartMetadata": {
              "oneOf": [
                {
                  "type": "boolean"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "helmVersion": {
              "type": "string",
              "enum": [
                "V2",
                "V3",
                "V380"
              ]
            },
            "metadata": {
              "type": "string"
            },
            "optionalValuesYaml": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "boolean"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "skipResourceVersioning": {
              "oneOf": [
                {
                  "type": "boolean"
                },
                {
                  "type": "string"
                }
              ]
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            },
            "subChartPath": {
              "type": "string"
            },
            "valuesPaths": {
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
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HelmManifestCommandFlag": {
      "type": "object",
      "required": [
        "commandType"
      ],
      "properties": {
        "commandType": {
          "type": "string",
          "enum": [
            "Fetch",
            "Template",
            "Pull",
            "Install",
            "Upgrade",
            "Rollback",
            "History",
            "Delete",
            "Uninstall",
            "List",
            "Add",
            "Update",
            "Version",
            "Test"
          ]
        },
        "flag": {
          "type": "string",
          "minLength": 1
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HelmRepoOverrideManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "type"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
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
    "HttpStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InheritFromManifestStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "paths": {
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
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InlineStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "content"
          ],
          "properties": {
            "content": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InputSetValidator": {
      "type": "object",
      "properties": {
        "parameters": {
          "type": "string"
        },
        "validatorType": {
          "type": "string",
          "enum": [
            "ALLOWED_VALUES",
            "REGEX",
            "SELECT_ONE_FROM",
            "SELECT_MANY_FROM"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "K8sManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "enableDeclarativeRollback": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "metadata": {
              "type": "string"
            },
            "optionalValuesYaml": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "boolean"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "skipResourceVersioning": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            },
            "valuesPaths": {
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
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KustomizeManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "commandFlags": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/KustomizeManifestCommandFlag"
              }
            },
            "enableDeclarativeRollback": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "metadata": {
              "type": "string"
            },
            "overlayConfiguration": {
              "$ref": "#/definitions/OverlayConfiguration"
            },
            "patchesPaths": {
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
            "pluginPath": {
              "type": "string"
            },
            "skipResourceVersioning": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KustomizeManifestCommandFlag": {
      "type": "object",
      "required": [
        "commandType"
      ],
      "properties": {
        "commandType": {
          "type": "string",
          "enum": [
            "Build"
          ]
        },
        "flag": {
          "type": "string",
          "minLength": 1
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KustomizePatchesManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ManifestAttributes": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ManifestConfig": {
      "type": "object",
      "required": [
        "identifier",
        "spec",
        "type"
      ],
      "properties": {
        "identifier": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "HelmChart",
            "HelmRepoOverride",
            "K8sManifest",
            "Kustomize",
            "KustomizePatches",
            "OpenshiftParam",
            "OpenshiftTemplate",
            "Values",
            "ServerlessAwsLambda",
            "ReleaseRepo",
            "DeploymentRepo",
            "EcsTaskDefinition",
            "EcsServiceDefinition",
            "EcsScalableTargetDefinition",
            "EcsScalingPolicyDefinition",
            "TasManifest",
            "TasVars",
            "TasAutoScaler",
            "AsgLaunchTemplate",
            "AsgConfiguration",
            "AsgAdditionalConfiguration",
            "AsgScalingPolicy",
            "AsgScheduledUpdateGroupAction",
            "GoogleCloudFunctionDefinition",
            "AwsLambdaFunctionDefinition",
            "AwsLambdaFunctionAliasDefinition",
            "AwsSamDirectory",
            "GoogleCloudFunctionGenOneDefinition",
            "GoogleCloudRunService",
            "GoogleCloudRunJob",
            "AzureContainerAppsConfiguration",
            "GoogleMigInstanceTemplate",
            "GoogleMigConfiguration",
            "GoogleMigAutoscalerConfiguration",
            "GoogleMigHealthCheckConfiguration",
            "EcsScheduledActionDefinition",
            "SalesforceManifest"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AsgAdditionalConfiguration"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgAdditionalConfigurationManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AsgConfiguration"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgConfigurationManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AsgLaunchTemplate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgLaunchTemplateManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AsgScalingPolicy"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgScalingPolicyManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AsgScheduledUpdateGroupAction"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgScheduledUpdateGroupActionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsLambdaFunctionAliasDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsLambdaFunctionAliasDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsLambdaFunctionDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsLambdaDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsSamDirectory"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSamDirectoryManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureContainerAppsConfiguration"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureContainerAppsConfigurationManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "DeploymentRepo"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitOpsDeploymentRepoManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "EcsScalableTargetDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsScalableTargetDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "EcsScalingPolicyDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsScalingPolicyDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "EcsScheduledActionDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsScheduledActionDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "EcsServiceDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsServiceDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "EcsTaskDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsTaskDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudFunctionDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudFunctionDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudFunctionGenOneDefinition"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudFunctionGenOneDefinitionManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudRunJob"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudRunJobManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudRunService"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudRunServiceManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleMigAutoscalerConfiguration"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleMigAutoscalerConfigurationManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleMigConfiguration"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleMigConfigurationManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleMigHealthCheckConfiguration"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleMigHealthCheckConfigurationManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleMigInstanceTemplate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleMigInstanceTemplateManifest"
              }
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
                "$ref": "#/definitions/HelmChartManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "HelmRepoOverride"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HelmRepoOverrideManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "K8sManifest"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/K8sManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Kustomize"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KustomizeManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KustomizePatches"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KustomizePatchesManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OpenshiftParam"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OpenshiftParamManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OpenshiftTemplate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OpenshiftManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ReleaseRepo"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ReleaseRepoManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceManifest"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ServerlessAwsLambda"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ServerlessAwsLambdaManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "TasAutoScaler"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AutoScalerManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "TasManifest"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TasManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "TasVars"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/VarsManifest"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Values"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ValuesManifest"
              }
            }
          }
        }
      ]
    },
    "ManifestConfigWrapper": {
      "type": "object",
      "properties": {
        "manifest": {
          "$ref": "#/definitions/ManifestConfig"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGEnvironmentConfig": {
      "type": "object",
      "properties": {
        "environment": {
          "$ref": "#/definitions/NGEnvironmentInfoConfig"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGEnvironmentGlobalOverride": {
      "type": "object",
      "properties": {
        "applicationSettings": {
          "$ref": "#/definitions/ApplicationSettingsConfiguration"
        },
        "configFiles": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ConfigFileWrapper"
          }
        },
        "connectionStrings": {
          "$ref": "#/definitions/ConnectionStringsConfiguration"
        },
        "manifests": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ManifestConfigWrapper"
          }
        },
        "metadata": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGEnvironmentInfoConfig": {
      "type": "object",
      "required": [
        "identifier",
        "name",
        "type",
        "orgIdentifier",
        "projectIdentifier"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "identifier": {
          "type": "string",
          "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
        },
        "metadata": {
          "type": "string"
        },
        "name": {
          "type": "string",
          "pattern": "^[a-zA-Z_0-9-.][-0-9a-zA-Z_\\s.]{0,127}$"
        },
        "orgIdentifier": {
          "type": "string"
        },
        "overrides": {
          "$ref": "#/definitions/NGEnvironmentGlobalOverride"
        },
        "projectIdentifier": {
          "type": "string"
        },
        "tags": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "type": {
          "type": "string",
          "enum": [
            "PreProduction",
            "Production"
          ]
        },
        "variables": {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "$ref": "#/definitions/NumberNGVariable"
              },
              {
                "$ref": "#/definitions/SecretNGVariable"
              },
              {
                "$ref": "#/definitions/StringNGVariable"
              }
            ]
          }
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGVariable": {
      "type": "object",
      "discriminator": "type",
      "properties": {
        "description": {
          "type": "string"
        },
        "metadata": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "required": {
          "type": "boolean"
        },
        "type": {
          "type": "string",
          "enum": [
            "String",
            "Number",
            "Secret"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NumberNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/NGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "default": {
              "type": "number",
              "format": "double"
            },
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$-]{0,127}$"
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
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "basePath": {
              "type": "string"
            },
            "config": {
              "$ref": "#/definitions/OciHelmChartStoreConfigWrapper"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartStoreConfig": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartStoreConfigWrapper": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "Generic",
            "ECR"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ECR"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmChartStoreEcrConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Generic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmChartStoreGenericConfig"
              }
            }
          }
        }
      ]
    },
    "OciHelmChartStoreEcrConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/OciHelmChartStoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "region": {
              "type": "string"
            },
            "registryId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartStoreGenericConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/OciHelmChartStoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "connectorRef": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldString"
                },
                {
                  "type": "string"
                }
              ]
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OpenshiftManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "enableDeclarativeRollback": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "metadata": {
              "type": "string"
            },
            "paramsPaths": {
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
            "skipResourceVersioning": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "string"
                },
                {
                  "type": "boolean"
                }
              ]
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OpenshiftParamManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OverlayConfiguration": {
      "type": "object",
      "required": [
        "kustomizeYamlFolderPath"
      ],
      "properties": {
        "kustomizeYamlFolderPath": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ParameterField": {
      "type": "object",
      "properties": {
        "defaultValue": {
          "type": "object"
        },
        "executionInput": {
          "type": "boolean"
        },
        "expression": {
          "type": "boolean"
        },
        "expressionValue": {
          "type": "string"
        },
        "inputSetValidator": {
          "$ref": "#/definitions/InputSetValidator"
        },
        "jsonResponseField": {
          "type": "boolean"
        },
        "responseField": {
          "type": "string"
        },
        "typeString": {
          "type": "boolean"
        },
        "value": {
          "type": "object"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ParameterFieldBoolean": {
      "type": "object",
      "properties": {
        "defaultValue": {
          "type": "boolean"
        },
        "executionInput": {
          "type": "boolean"
        },
        "expression": {
          "type": "boolean"
        },
        "expressionValue": {
          "type": "string"
        },
        "inputSetValidator": {
          "$ref": "#/definitions/InputSetValidator"
        },
        "jsonResponseField": {
          "type": "boolean"
        },
        "responseField": {
          "type": "string"
        },
        "typeString": {
          "type": "boolean"
        },
        "value": {
          "type": "boolean"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ParameterFieldString": {
      "type": "object",
      "properties": {
        "defaultValue": {
          "type": "string"
        },
        "executionInput": {
          "type": "boolean"
        },
        "expression": {
          "type": "boolean"
        },
        "expressionValue": {
          "type": "string"
        },
        "inputSetValidator": {
          "$ref": "#/definitions/InputSetValidator"
        },
        "jsonResponseField": {
          "type": "boolean"
        },
        "responseField": {
          "type": "string"
        },
        "typeString": {
          "type": "boolean"
        },
        "value": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ReleaseRepoManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "S3StoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
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
            "metadata": {
              "type": "string"
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "region": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "S3UrlStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region",
            "urls"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "region": {
              "type": "string"
            },
            "urls": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "destructiveChangesPath": {
              "type": "string"
            },
            "manifestPath": {
              "type": "string"
            },
            "manifestStore": {
              "$ref": "#/definitions/StoreConfigWrapper"
            },
            "metadata": {
              "type": "string"
            },
            "metadataConfigurationType": {
              "type": "string",
              "enum": [
                "all",
                "inline",
                "manifest"
              ]
            },
            "metadatas": {
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
            "sourcePaths": {
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
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SecretNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/NGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "default": {
              "type": "string"
            },
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$-]{0,127}$"
            },
            "type": {
              "type": "string",
              "enum": [
                "Secret"
              ]
            },
            "value": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServerlessAwsLambdaManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "configOverridePath": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "StoreConfig": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "StoreConfigWrapper": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "CustomRemote",
            "Git",
            "Github",
            "Bitbucket",
            "GitLab",
            "Http",
            "S3",
            "Gcs",
            "Inline",
            "Artifactory",
            "S3Url",
            "InheritFromManifest",
            "Harness",
            "OciHelmChart",
            "AzureRepo",
            "ArtifactBundle",
            "HarnessCode"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ArtifactBundle"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ArtifactBundleStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Artifactory"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ArtifactoryStoreConfig"
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
                "$ref": "#/definitions/AzureRepoStore"
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
                "$ref": "#/definitions/BitbucketStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomRemote"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CustomRemoteStoreConfig"
              }
            }
          }
        },
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
                "$ref": "#/definitions/GcsStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Git"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GitLab"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitLabStore"
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
                "$ref": "#/definitions/GithubStore"
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
                "$ref": "#/definitions/HarnessStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "HarnessCode"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessCodeStore"
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
                "$ref": "#/definitions/HttpStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "InheritFromManifest"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/InheritFromManifestStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Inline"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/InlineStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OciHelmChart"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmChartConfig"
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
                "$ref": "#/definitions/S3StoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "S3Url"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/S3UrlStoreConfig"
              }
            }
          }
        }
      ]
    },
    "StringNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/NGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "default": {
              "type": "string"
            },
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$-]{0,127}$"
            },
            "type": {
              "type": "string",
              "enum": [
                "String"
              ]
            },
            "value": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TasManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "autoScalerPath": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "cfCliVersion": {
              "type": "string",
              "enum": [
                "V7"
              ]
            },
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            },
            "varsPaths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ValuesManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "optionalValuesYaml": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldBoolean"
                },
                {
                  "type": "boolean"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "VarsManifest": {
      "allOf": [
        {
          "$ref": "#/definitions/ManifestAttributes"
        },
        {
          "type": "object",
          "properties": {
            "metadata": {
              "type": "string"
            },
            "store": {
              "$ref": "#/definitions/StoreConfigWrapper"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
};

export default schema;
export const meta = {
  "resourceType": "environment",
  "scope": "project",
  "syncedAt": "2026-05-27T09:53:36.734Z",
  "accountId": "VpehPBwPQ9qKsX-xDP8SFg",
  "orgId": "default",
  "projectId": "aidevops"
};
