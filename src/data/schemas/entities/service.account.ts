// Auto-generated — do not edit manually. Run `pnpm sync-entity-schemas` to regenerate.
// @ts-nocheck
// Synced: 2026-05-27T09:53:36.734Z | entity=service | scope=account

const schema: Record<string, any> = {
  "type": "object",
  "properties": {
    "metadata": {
      "type": "string"
    },
    "service": {
      "$ref": "#/definitions/NGServiceV2InfoConfig"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "AMIArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "filters": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/AMIFilter"
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
              "type": "string",
              "minLength": 1
            },
            "tags": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/AMITag"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "version": {
              "type": "string"
            },
            "versionRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "versionRegex"
              ]
            },
            {
              "required": [
                "version"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AMIFilter": {
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
    "AMITag": {
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
    "AcrArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "registry",
            "repository",
            "subscriptionId"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
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
            },
            "tagRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tagRegex"
              ]
            },
            {
              "required": [
                "tag"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AmazonS3ArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "bucketName",
            "connectorRef"
          ],
          "properties": {
            "bucketName": {
              "type": "string",
              "minLength": 1
            },
            "connectorRef": {
              "type": "string"
            },
            "fileFilter": {
              "type": "string"
            },
            "filePath": {
              "type": "string"
            },
            "filePathRegex": {
              "type": "string"
            },
            "region": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "filePath"
              ]
            },
            {
              "required": [
                "filePathRegex"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
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
    "AppsetConfig": {
      "type": "object",
      "required": [
        "agentIdentifier",
        "appSetIdentifier"
      ],
      "properties": {
        "agentIdentifier": {
          "type": "string"
        },
        "appSetIdentifier": {
          "type": "string"
        },
        "identifier": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AppsetConfigWrapper": {
      "type": "object",
      "properties": {
        "appset": {
          "$ref": "#/definitions/AppsetConfig"
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
    "ArtifactConfig": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactListConfig": {
      "type": "object",
      "properties": {
        "primary": {
          "$ref": "#/definitions/PrimaryArtifact"
        },
        "sidecars": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/SidecarArtifactWrapper"
          }
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactOverrideSetWrapper": {
      "type": "object",
      "properties": {
        "overrideSet": {
          "$ref": "#/definitions/ArtifactOverrideSets"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactOverrideSets": {
      "type": "object",
      "properties": {
        "artifacts": {
          "$ref": "#/definitions/ArtifactListConfig"
        },
        "identifier": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactSource": {
      "type": "object",
      "required": [
        "identifier"
      ],
      "properties": {
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
        "template": {
          "$ref": "#/definitions/TemplateLinkConfig"
        },
        "type": {
          "type": "string",
          "enum": [
            "DockerRegistry",
            "Gcr",
            "Ecr",
            "Nexus3Registry",
            "Nexus2Registry",
            "ArtifactoryRegistry",
            "CustomArtifact",
            "Acr",
            "Jenkins",
            "AmazonS3",
            "GoogleArtifactRegistry",
            "GithubPackageRegistry",
            "AzureArtifacts",
            "AmazonMachineImage",
            "Bamboo",
            "GoogleCloudStorage",
            "GoogleCloudSource",
            "Har",
            "SalesforceOrg",
            "SalesforcePackage",
            "SalesforceDxProject",
            "GceImage"
          ]
        }
      },
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
                "$ref": "#/definitions/AcrArtifactConfig"
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
                "$ref": "#/definitions/AMIArtifactConfig"
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
                "$ref": "#/definitions/AmazonS3ArtifactConfig"
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
                "$ref": "#/definitions/ArtifactoryRegistryArtifactConfig"
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
                "$ref": "#/definitions/AzureArtifactsConfig"
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
                "$ref": "#/definitions/BambooArtifactConfig"
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
                "$ref": "#/definitions/CustomArtifactConfig"
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
                "$ref": "#/definitions/DockerHubArtifactConfig"
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
                "$ref": "#/definitions/EcrArtifactConfig"
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
                "$ref": "#/definitions/GCEImageArtifactConfig"
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
                "$ref": "#/definitions/GcrArtifactConfig"
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
                "$ref": "#/definitions/GithubPackagesArtifactConfig"
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
                "$ref": "#/definitions/GoogleArtifactRegistryConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudSource"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudSourceArtifactConfig"
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
                "$ref": "#/definitions/GoogleCloudStorageArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Har"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessArtifactRegistryConfig"
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
                "$ref": "#/definitions/JenkinsArtifactConfig"
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
                "$ref": "#/definitions/Nexus2RegistryArtifactConfig"
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
                "$ref": "#/definitions/NexusRegistryArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceDxProject"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceDxProjectArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceOrg"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceOrgArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforcePackage"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforcePackageArtifactConfig"
              }
            }
          }
        }
      ]
    },
    "ArtifactoryRegistryArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "repository",
            "repositoryFormat"
          ],
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
            "artifactPathFilter": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
            },
            "repository": {
              "type": "string"
            },
            "repositoryFormat": {
              "type": "string",
              "enum": [
                "docker",
                "generic"
              ]
            },
            "repositoryUrl": {
              "type": "string"
            },
            "tag": {
              "type": "string"
            },
            "tagRegex": {
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
    "AsgServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "userData": {
              "$ref": "#/definitions/UserDataConfiguration"
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
    "AwsLambdaServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
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
    "AwsSamServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureArtifactsConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "feed",
            "package",
            "packageType",
            "scope"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "feed": {
              "type": "string",
              "minLength": 1
            },
            "package": {
              "type": "string",
              "minLength": 1
            },
            "packageType": {
              "type": "string",
              "enum": [
                "maven",
                "nuget",
                "upack"
              ]
            },
            "project": {
              "type": "string"
            },
            "scope": {
              "type": "string",
              "enum": [
                "project",
                "org"
              ]
            },
            "version": {
              "type": "string"
            },
            "versionRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "versionRegex"
              ]
            },
            {
              "required": [
                "version"
              ]
            }
          ]
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
    "AzureContainerAppsServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureFunctionServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
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
    "AzureWebAppServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "applicationSettings": {
              "$ref": "#/definitions/ApplicationSettingsConfiguration"
            },
            "connectionStrings": {
              "$ref": "#/definitions/ConnectionStringsConfiguration"
            },
            "startupCommand": {
              "$ref": "#/definitions/StartupCommandConfiguration"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BambooArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "planKey"
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
            "build": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "planKey": {
              "type": "string"
            }
          }
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
    "ConfigFileOverrideSetWrapper": {
      "type": "object",
      "properties": {
        "overrideSet": {
          "$ref": "#/definitions/ConfigFileOverrideSets"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConfigFileOverrideSets": {
      "type": "object",
      "properties": {
        "configFiles": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ConfigFileWrapper"
          }
        },
        "identifier": {
          "type": "string"
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
    "CustomArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "version"
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
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "inputs": {
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
            },
            "metadata": {
              "type": "string"
            },
            "scripts": {
              "$ref": "#/definitions/CustomArtifactScripts"
            },
            "timeout": {
              "type": "string",
              "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(<\\+input>.*)|(.*<\\+.*>.*)|(^$))$"
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
    "CustomArtifactScriptInfo": {
      "type": "object",
      "required": [
        "shell",
        "source"
      ],
      "properties": {
        "shell": {
          "type": "string",
          "enum": [
            "Bash",
            "PowerShell"
          ]
        },
        "source": {
          "$ref": "#/definitions/CustomArtifactScriptSourceWrapper"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomArtifactScriptSourceWrapper": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
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
                "$ref": "#/definitions/CustomScriptInlineSource"
              }
            }
          }
        }
      ]
    },
    "CustomArtifactScripts": {
      "type": "object",
      "required": [
        "fetchAllArtifacts"
      ],
      "properties": {
        "fetchAllArtifacts": {
          "$ref": "#/definitions/FetchAllArtifacts"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "required": [
            "customDeploymentRef"
          ],
          "properties": {
            "customDeploymentRef": {
              "$ref": "#/definitions/StepTemplateRef",
              "minLength": 1
            }
          }
        }
      ],
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
    "CustomScriptBaseSource": {
      "type": "object",
      "discriminator": "type",
      "properties": {
        "type": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomScriptInlineSource": {
      "allOf": [
        {
          "$ref": "#/definitions/CustomScriptBaseSource"
        },
        {
          "type": "object",
          "properties": {
            "script": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "DockerHubArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "imagePath"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
            },
            "imagePath": {
              "type": "string"
            },
            "tag": {
              "type": "string"
            },
            "tagRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tagRegex"
              ]
            },
            {
              "required": [
                "tag"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcrArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "imagePath",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
            },
            "imagePath": {
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
            },
            "tag": {
              "type": "string"
            },
            "tagRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tagRegex"
              ]
            },
            {
              "required": [
                "tag"
              ]
            }
          ]
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
    "EcsServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "ecsTaskDefinitionArn": {
              "type": "string"
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
    "ElastigroupServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "startupScript": {
              "$ref": "#/definitions/StartupScriptConfiguration"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "FetchAllArtifacts": {
      "type": "object",
      "required": [
        "spec"
      ],
      "properties": {
        "artifactsArrayPath": {
          "oneOf": [
            {
              "$ref": "#/definitions/ParameterFieldString"
            },
            {
              "type": "string"
            }
          ]
        },
        "attributes": {
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
        },
        "spec": {
          "$ref": "#/definitions/CustomArtifactScriptInfo"
        },
        "versionPath": {
          "oneOf": [
            {
              "$ref": "#/definitions/ParameterFieldString"
            },
            {
              "type": "string"
            }
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GCEImageArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "project"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "filters": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/GCEImageFilter"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "labels": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/GCEImageLabel"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "project": {
              "type": "string",
              "minLength": 1
            },
            "version": {
              "type": "string"
            },
            "versionRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "versionRegex"
              ]
            },
            {
              "required": [
                "version"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GCEImageFilter": {
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
    "GCEImageLabel": {
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
    "GcrArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "imagePath",
            "registryHostname"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
            },
            "imagePath": {
              "type": "string"
            },
            "registryHostname": {
              "type": "string"
            },
            "tag": {
              "type": "string"
            },
            "tagRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tagRegex"
              ]
            },
            {
              "required": [
                "tag"
              ]
            }
          ]
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
    "GithubPackagesArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "packageName",
            "packageType"
          ],
          "properties": {
            "artifactId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "digest": {
              "type": "string"
            },
            "extension": {
              "type": "string"
            },
            "groupId": {
              "type": "string"
            },
            "org": {
              "type": "string"
            },
            "packageName": {
              "type": "string",
              "minLength": 1
            },
            "packageType": {
              "type": "string",
              "enum": [
                "npm",
                "maven",
                "rubygems",
                "nuget",
                "container"
              ]
            },
            "user": {
              "type": "string"
            },
            "version": {
              "type": "string"
            },
            "versionRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "versionRegex"
              ]
            },
            {
              "required": [
                "version"
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
    "GoogleArtifactRegistryConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "package",
            "project",
            "region",
            "repositoryName",
            "repositoryType"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "package": {
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
            "repositoryType": {
              "type": "string",
              "enum": [
                "docker"
              ]
            },
            "version": {
              "type": "string"
            },
            "versionRegex": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "versionRegex"
              ]
            },
            {
              "required": [
                "version"
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
    "GoogleCloudFunctionsServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "environmentType": {
              "type": "string"
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
    "GoogleCloudRunServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleCloudSourceArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "fetchType",
            "project",
            "repository",
            "sourceDirectory"
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
            "fetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit",
                "Tag"
              ]
            },
            "project": {
              "type": "string"
            },
            "repository": {
              "type": "string"
            },
            "sourceDirectory": {
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
    "GoogleCloudStorageArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "artifactPath",
            "bucket",
            "connectorRef",
            "project"
          ],
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
            "project": {
              "type": "string"
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
    "GoogleMigServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessArtifactRegistryConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "registryRef",
            "type"
          ],
          "properties": {
            "registryRef": {
              "type": "string"
            },
            "type": {
              "type": "string",
              "enum": [
                "docker",
                "generic",
                "maven",
                "npm",
                "nuget"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "docker"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessRegistryDockerConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "generic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessRegistryGenericConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "maven"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessRegistryMavenConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "npm"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessRegistryNpmConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "nuget"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessRegistryNugetConfig"
              }
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
    "HarnessRegistryConfigSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessRegistryDockerConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "imagePath",
            "tag"
          ],
          "properties": {
            "digest": {
              "type": "string"
            },
            "imagePath": {
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
    "HarnessRegistryGenericConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "artifact",
            "fileName",
            "version"
          ],
          "properties": {
            "artifact": {
              "type": "string"
            },
            "fileName": {
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
    "HarnessRegistryMavenConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "artifactId",
            "groupId",
            "version"
          ],
          "properties": {
            "artifactFileName": {
              "type": "string"
            },
            "artifactId": {
              "type": "string"
            },
            "artifactName": {
              "type": "string"
            },
            "artifactVersion": {
              "type": "string"
            },
            "classifier": {
              "type": "string"
            },
            "extension": {
              "type": "string"
            },
            "groupId": {
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
    "HarnessRegistryNpmConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "packageName",
            "version"
          ],
          "properties": {
            "artifactFileName": {
              "type": "string"
            },
            "artifactName": {
              "type": "string"
            },
            "artifactVersion": {
              "type": "string"
            },
            "packageName": {
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
    "HarnessRegistryNugetConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "packageName",
            "version"
          ],
          "properties": {
            "artifactFileName": {
              "type": "string"
            },
            "artifactName": {
              "type": "string"
            },
            "artifactVersion": {
              "type": "string"
            },
            "packageName": {
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
    "HarnessRelease": {
      "type": "object",
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string"
        }
      },
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
    "JenkinsArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "jobName"
          ],
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
            "jobName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JsonNode": {
      "type": "object",
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
    "KubernetesServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "appsetConfigs": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/AppsetConfigWrapper"
              }
            },
            "hooks": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/ServiceHookWrapper"
              }
            },
            "manifestConfigurations": {
              "$ref": "#/definitions/ManifestConfigurations"
            },
            "release": {
              "$ref": "#/definitions/HarnessRelease"
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
    "ManifestConfigurations": {
      "type": "object",
      "properties": {
        "primaryManifestRef": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ManifestOverrideSetWrapper": {
      "type": "object",
      "properties": {
        "overrideSet": {
          "$ref": "#/definitions/ManifestOverrideSets"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ManifestOverrideSets": {
      "type": "object",
      "properties": {
        "identifier": {
          "type": "string"
        },
        "manifests": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ManifestConfigWrapper"
          }
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGServiceConfig": {
      "type": "object",
      "properties": {
        "metadata": {
          "type": "string"
        },
        "service": {
          "$ref": "#/definitions/NGServiceV2InfoConfig"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGServiceV2InfoConfig": {
      "type": "object",
      "required": [
        "identifier",
        "name"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "gitOpsEnabled": {
          "type": "boolean"
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
        "serviceDefinition": {
          "$ref": "#/definitions/ServiceDefinition"
        },
        "tags": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "useFromStage": {
          "$ref": "#/definitions/ServiceUseFromStageV2"
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
    "NGVariableOverrideSetWrapper": {
      "type": "object",
      "properties": {
        "overrideSet": {
          "$ref": "#/definitions/NGVariableOverrideSets"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NGVariableOverrideSets": {
      "type": "object",
      "properties": {
        "identifier": {
          "type": "string"
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
    "NativeHelmServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "hooks": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/ServiceHookWrapper"
              }
            },
            "manifestConfigurations": {
              "$ref": "#/definitions/ManifestConfigurations"
            },
            "release": {
              "$ref": "#/definitions/HarnessRelease"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "Nexus2RegistryArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "repository",
            "repositoryFormat"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "repository": {
              "type": "string"
            },
            "repositoryFormat": {
              "type": "string",
              "enum": [
                "maven",
                "npm",
                "nuget"
              ]
            },
            "tag": {
              "type": "string"
            },
            "tagRegex": {
              "type": "string"
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "docker"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryDockerConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "maven"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryMavenConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "npm"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryNpmConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "nuget"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryNugetConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "raw"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryRawConfig"
              }
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tagRegex"
              ]
            },
            {
              "required": [
                "tag"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "repository",
            "repositoryFormat"
          ],
          "properties": {
            "artifactPath": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "digest": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "repository": {
              "type": "string"
            },
            "repositoryFormat": {
              "type": "string",
              "enum": [
                "docker",
                "maven",
                "npm",
                "nuget",
                "raw"
              ]
            },
            "repositoryPort": {
              "oneOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "repositoryUrl": {
              "type": "string"
            },
            "tag": {
              "type": "string"
            },
            "tagRegex": {
              "type": "string"
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "docker"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryDockerConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "maven"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryMavenConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "npm"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryNpmConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "nuget"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryNugetConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "repositoryFormat": {
                "const": "raw"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusRegistryRawConfig"
              }
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tagRegex"
              ]
            },
            {
              "required": [
                "tag"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryConfigSpec": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryDockerConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/NexusRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "artifactPath"
          ],
          "properties": {
            "artifactPath": {
              "type": "string"
            },
            "repositoryPort": {
              "oneOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "repositoryUrl": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "repositoryPort"
              ]
            },
            {
              "required": [
                "repositoryUrl"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryMavenConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/NexusRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "artifactId",
            "groupId"
          ],
          "properties": {
            "artifactId": {
              "type": "string"
            },
            "classifier": {
              "type": "string"
            },
            "extension": {
              "type": "string"
            },
            "groupId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryNpmConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/NexusRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "packageName"
          ],
          "properties": {
            "packageName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryNugetConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/NexusRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "packageName"
          ],
          "properties": {
            "packageName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusRegistryRawConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/NexusRegistryConfigSpec"
        },
        {
          "type": "object",
          "required": [
            "group"
          ],
          "properties": {
            "group": {
              "type": "string"
            }
          }
        }
      ],
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
    "PrimaryArtifact": {
      "type": "object",
      "properties": {
        "primaryArtifactRef": {
          "type": "string"
        },
        "sources": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ArtifactSource"
          }
        },
        "type": {
          "type": "string",
          "enum": [
            "DockerRegistry",
            "Gcr",
            "Ecr",
            "Nexus3Registry",
            "Nexus2Registry",
            "ArtifactoryRegistry",
            "CustomArtifact",
            "Acr",
            "Jenkins",
            "AmazonS3",
            "GoogleArtifactRegistry",
            "GithubPackageRegistry",
            "AzureArtifacts",
            "AmazonMachineImage",
            "Bamboo",
            "GoogleCloudStorage",
            "GoogleCloudSource",
            "Har",
            "SalesforceOrg",
            "SalesforcePackage",
            "SalesforceDxProject",
            "GceImage"
          ]
        }
      },
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
                "$ref": "#/definitions/AcrArtifactConfig"
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
                "$ref": "#/definitions/AMIArtifactConfig"
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
                "$ref": "#/definitions/AmazonS3ArtifactConfig"
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
                "$ref": "#/definitions/ArtifactoryRegistryArtifactConfig"
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
                "$ref": "#/definitions/AzureArtifactsConfig"
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
                "$ref": "#/definitions/BambooArtifactConfig"
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
                "$ref": "#/definitions/CustomArtifactConfig"
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
                "$ref": "#/definitions/DockerHubArtifactConfig"
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
                "$ref": "#/definitions/EcrArtifactConfig"
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
                "$ref": "#/definitions/GCEImageArtifactConfig"
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
                "$ref": "#/definitions/GcrArtifactConfig"
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
                "$ref": "#/definitions/GithubPackagesArtifactConfig"
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
                "$ref": "#/definitions/GoogleArtifactRegistryConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudSource"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudSourceArtifactConfig"
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
                "$ref": "#/definitions/GoogleCloudStorageArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Har"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessArtifactRegistryConfig"
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
                "$ref": "#/definitions/JenkinsArtifactConfig"
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
                "$ref": "#/definitions/Nexus2RegistryArtifactConfig"
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
                "$ref": "#/definitions/NexusRegistryArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceDxProject"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceDxProjectArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceOrg"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceOrgArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforcePackage"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforcePackageArtifactConfig"
              }
            }
          }
        }
      ]
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
    "SalesforceDxProjectArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "properties": {
            "deployableRef": {
              "type": "string"
            },
            "destructiveChangesPath": {
              "type": "string"
            },
            "manifestPath": {
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
            "metadataStore": {
              "$ref": "#/definitions/StoreConfigWrapper"
            },
            "metadatas": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "sourcePaths": {
              "type": "array",
              "items": {
                "type": "string"
              }
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
    "SalesforceOrgArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "metadataConfigurationType"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "manifestStore": {
              "$ref": "#/definitions/StoreConfigWrapper"
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
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "sourcePaths": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforcePackageArtifactConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactConfig"
        },
        {
          "type": "object",
          "required": [
            "packageVersionId"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "deployableRef": {
              "type": "string"
            },
            "installationKeyRef": {
              "type": "string"
            },
            "packageId": {
              "type": "string"
            },
            "packageVersionId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
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
    "ServerlessAwsLambdaServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "pluginInfo": {
              "readOnly": true,
              "$ref": "#/definitions/ServerlessPluginInfo"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServerlessPluginInfo": {
      "type": "object",
      "properties": {
        "arch": {
          "type": "string"
        },
        "os": {
          "type": "string"
        },
        "runtimeLanguage": {
          "type": "string"
        },
        "serverlessVersion": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceDefinition": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Kubernetes",
            "NativeHelm",
            "Ssh",
            "WinRm",
            "ServerlessAwsLambda",
            "AzureWebApp",
            "AzureFunction",
            "CustomDeployment",
            "ECS",
            "Elastigroup",
            "TAS",
            "Asg",
            "GoogleCloudFunctions",
            "AwsLambda",
            "AWS_SAM",
            "SERVICE_YAML_V1_TYPE",
            "GoogleCloudRun",
            "Salesforce",
            "GoogleManagedInstanceGroup",
            "AzureContainerApps"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AWS_SAM"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSamServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Asg"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsLambda"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsLambdaServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureContainerApps"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureContainerAppsServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureFunction"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureFunctionServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureWebApp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureWebAppServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomDeployment"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CustomDeploymentServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ECS"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Elastigroup"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ElastigroupServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudFunctions"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudFunctionsServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudRun"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudRunServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleManagedInstanceGroup"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleMigServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Kubernetes"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "NativeHelm"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NativeHelmServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Salesforce"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceServiceSpec"
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
                "$ref": "#/definitions/ServerlessAwsLambdaServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Ssh"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SshServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "TAS"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TanzuApplicationServiceSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "WinRm"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/WinRmServiceSpec"
              }
            }
          }
        }
      ]
    },
    "ServiceHook": {
      "type": "object",
      "required": [
        "identifier",
        "store",
        "storeType"
      ],
      "properties": {
        "actions": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "FetchFiles",
              "TemplateManifest",
              "SteadyStateCheck"
            ]
          }
        },
        "identifier": {
          "type": "string"
        },
        "storeType": {
          "type": "string",
          "enum": [
            "Inline"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "ArtifactBundle"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/ArtifactBundleStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Artifactory"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/ArtifactoryStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "AzureRepo"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/AzureRepoStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Bitbucket"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/BitbucketStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "CustomRemote"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/CustomRemoteStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Gcs"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/GcsStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Git"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/GitStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "GitLab"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/GitLabStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Github"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/GithubStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Harness"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/HarnessStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "HarnessCode"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/HarnessCodeStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Http"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/HttpStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "InheritFromManifest"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/InheritFromManifestStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "Inline"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/InlineStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "OciHelmChart"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/OciHelmChartConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "S3"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/S3StoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "storeType": {
                "const": "S3Url"
              }
            }
          },
          "then": {
            "properties": {
              "store": {
                "$ref": "#/definitions/S3UrlStoreConfig"
              }
            }
          }
        }
      ]
    },
    "ServiceHookWrapper": {
      "type": "object",
      "properties": {
        "postHook": {
          "$ref": "#/definitions/ServiceHook"
        },
        "preHook": {
          "$ref": "#/definitions/ServiceHook"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "oneOf": [
            {
              "required": [
                "preHook"
              ]
            },
            {
              "required": [
                "postHook"
              ]
            }
          ]
        }
      ]
    },
    "ServiceSpec": {
      "type": "object",
      "discriminator": "type",
      "properties": {
        "artifacts": {
          "$ref": "#/definitions/ArtifactListConfig"
        },
        "configFiles": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ConfigFileWrapper"
          }
        },
        "manifests": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ManifestConfigWrapper"
          }
        },
        "variables": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/NGVariable"
          }
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceUseFromStageV2": {
      "type": "object",
      "required": [
        "stage"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "stage": {
          "type": "string",
          "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SidecarArtifact": {
      "type": "object",
      "required": [
        "identifier"
      ],
      "properties": {
        "identifier": {
          "type": "string"
        },
        "name": {
          "type": "string",
          "pattern": "^[a-zA-Z_0-9-.][-0-9a-zA-Z_\\s.]{0,127}$"
        },
        "template": {
          "$ref": "#/definitions/TemplateLinkConfig"
        },
        "type": {
          "type": "string",
          "enum": [
            "DockerRegistry",
            "Gcr",
            "Ecr",
            "Nexus3Registry",
            "Nexus2Registry",
            "ArtifactoryRegistry",
            "CustomArtifact",
            "Acr",
            "Jenkins",
            "AmazonS3",
            "GoogleArtifactRegistry",
            "GithubPackageRegistry",
            "AzureArtifacts",
            "AmazonMachineImage",
            "Bamboo",
            "GoogleCloudStorage",
            "GoogleCloudSource",
            "Har",
            "SalesforceOrg",
            "SalesforcePackage",
            "SalesforceDxProject",
            "GceImage"
          ]
        }
      },
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
                "$ref": "#/definitions/AcrArtifactConfig"
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
                "$ref": "#/definitions/AMIArtifactConfig"
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
                "$ref": "#/definitions/AmazonS3ArtifactConfig"
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
                "$ref": "#/definitions/ArtifactoryRegistryArtifactConfig"
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
                "$ref": "#/definitions/AzureArtifactsConfig"
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
                "$ref": "#/definitions/BambooArtifactConfig"
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
                "$ref": "#/definitions/CustomArtifactConfig"
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
                "$ref": "#/definitions/DockerHubArtifactConfig"
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
                "$ref": "#/definitions/EcrArtifactConfig"
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
                "$ref": "#/definitions/GCEImageArtifactConfig"
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
                "$ref": "#/definitions/GcrArtifactConfig"
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
                "$ref": "#/definitions/GithubPackagesArtifactConfig"
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
                "$ref": "#/definitions/GoogleArtifactRegistryConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudSource"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudSourceArtifactConfig"
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
                "$ref": "#/definitions/GoogleCloudStorageArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Har"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessArtifactRegistryConfig"
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
                "$ref": "#/definitions/JenkinsArtifactConfig"
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
                "$ref": "#/definitions/Nexus2RegistryArtifactConfig"
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
                "$ref": "#/definitions/NexusRegistryArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceDxProject"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceDxProjectArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforceOrg"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceOrgArtifactConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SalesforcePackage"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforcePackageArtifactConfig"
              }
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "template"
              ]
            },
            {
              "required": [
                "spec"
              ]
            }
          ]
        }
      ]
    },
    "SidecarArtifactWrapper": {
      "type": "object",
      "properties": {
        "sidecar": {
          "$ref": "#/definitions/SidecarArtifact"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SshServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {}
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "StartupCommandConfiguration": {
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
    "StartupScriptConfiguration": {
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
    "StepTemplateRef": {
      "type": "object",
      "required": [
        "templateRef"
      ],
      "properties": {
        "templateRef": {
          "type": "string"
        },
        "versionLabel": {
          "type": "string"
        }
      },
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
    "TanzuApplicationServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "cliEnvironmentVariables": {
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
    "TemplateLinkConfig": {
      "type": "object",
      "required": [
        "templateRef"
      ],
      "properties": {
        "gitBranch": {
          "type": "string"
        },
        "templateInputs": {
          "$ref": "#/definitions/JsonNode"
        },
        "templateRef": {
          "type": "string"
        },
        "templateVariables": {
          "$ref": "#/definitions/JsonNode"
        },
        "versionLabel": {
          "type": "string",
          "pattern": "^[0-9a-zA-Z][^\\s/&]{0,63}$"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "UserDataConfiguration": {
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
    },
    "WinRmServiceSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceSpec"
        },
        {
          "type": "object",
          "properties": {
            "artifactOverrideSets": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/ArtifactOverrideSetWrapper"
              }
            },
            "configFileOverrideSets": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/ConfigFileOverrideSetWrapper"
              }
            },
            "manifestOverrideSets": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/ManifestOverrideSetWrapper"
              }
            },
            "variableOverrideSets": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/NGVariableOverrideSetWrapper"
              }
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
  "resourceType": "service",
  "scope": "account",
  "syncedAt": "2026-05-27T09:53:36.734Z",
  "accountId": "VpehPBwPQ9qKsX-xDP8SFg",
  "orgId": "default",
  "projectId": "aidevops"
};
