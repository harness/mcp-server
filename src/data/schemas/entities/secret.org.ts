// Auto-generated — do not edit manually. Run `pnpm sync-entity-schemas` to regenerate.
// @ts-nocheck
// Synced: 2026-05-27T09:53:36.734Z | entity=secret | scope=org

const schema: Record<string, any> = {
  "type": "object",
  "required": [
    "secret"
  ],
  "properties": {
    "secret": {
      "$ref": "#/definitions/SecretDTOV2"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "AdditionalMetadata": {
      "type": "object",
      "properties": {
        "values": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BaseSSHSpecDTO": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BaseWinRmSpecDTO": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KerberosConfigDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/BaseSSHSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "principal",
            "realm"
          ],
          "properties": {
            "principal": {
              "type": "string"
            },
            "realm": {
              "type": "string"
            },
            "tgtGenerationMethod": {
              "type": "string",
              "enum": [
                "KeyTabFilePath",
                "Password"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "tgtGenerationMethod": {
                "const": "KeyTabFilePath"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TGTKeyTabFilePathSpecDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "tgtGenerationMethod": {
                "const": "Password"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TGTPasswordSpecDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KerberosWinRmConfigDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/BaseWinRmSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "principal",
            "realm"
          ],
          "properties": {
            "principal": {
              "type": "string"
            },
            "realm": {
              "type": "string"
            },
            "skipCertChecks": {
              "type": "boolean"
            },
            "tgtGenerationMethod": {
              "type": "string",
              "enum": [
                "KeyTabFilePath",
                "Password"
              ]
            },
            "useNoProfile": {
              "type": "boolean"
            },
            "useSSL": {
              "type": "boolean"
            }
          }
        },
        {
          "if": {
            "properties": {
              "tgtGenerationMethod": {
                "const": "KeyTabFilePath"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TGTKeyTabFilePathSpecDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "tgtGenerationMethod": {
                "const": "Password"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TGTPasswordSpecDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NTLMConfigDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/BaseWinRmSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "domain",
            "password",
            "username"
          ],
          "properties": {
            "domain": {
              "type": "string"
            },
            "password": {
              "type": "string"
            },
            "skipCertChecks": {
              "type": "boolean"
            },
            "useNoProfile": {
              "type": "boolean"
            },
            "useSSL": {
              "type": "boolean"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SSHAuthDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "SSH",
            "Kerberos"
          ]
        },
        "useSshClient": {
          "type": "boolean",
          "readOnly": true
        },
        "useSshj": {
          "type": "boolean",
          "readOnly": true
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Kerberos"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KerberosConfigDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SSH"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SSHConfigDTO"
              }
            }
          }
        }
      ]
    },
    "SSHConfigDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/BaseSSHSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "credentialType",
            "spec"
          ],
          "properties": {
            "credentialType": {
              "type": "string",
              "enum": [
                "Password",
                "KeyPath",
                "KeyReference"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "credentialType": {
                "const": "KeyPath"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SSHKeyPathCredentialDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "credentialType": {
                "const": "KeyReference"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SSHKeyReferenceCredentialDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "credentialType": {
                "const": "Password"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SSHPasswordCredentialDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SSHCredentialSpecDTO": {
      "type": "object",
      "discriminator": "credentialType",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SSHKeyPathCredentialDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SSHCredentialSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "keyPath",
            "userName"
          ],
          "properties": {
            "encryptedPassphrase": {
              "type": "string"
            },
            "keyPath": {
              "type": "string"
            },
            "userName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SSHKeyReferenceCredentialDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SSHCredentialSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "key",
            "userName"
          ],
          "properties": {
            "encryptedPassphrase": {
              "type": "string"
            },
            "key": {
              "type": "string"
            },
            "userName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SSHKeySpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SecretSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "auth"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/SSHAuthDTO"
            },
            "port": {
              "type": "integer",
              "format": "int32"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SSHPasswordCredentialDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SSHCredentialSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "password",
            "userName"
          ],
          "properties": {
            "password": {
              "type": "string"
            },
            "userName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SecretDTOV2": {
      "type": "object",
      "required": [
        "identifier",
        "name",
        "spec",
        "type",
        "orgIdentifier"
      ],
      "properties": {
        "description": {
          "type": "string"
        },
        "identifier": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "orgIdentifier": {
          "type": "string"
        },
        "parentUniqueId": {
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
            "SecretFile",
            "SecretText",
            "SSHKey",
            "WinRmCredentials"
          ]
        },
        "uniqueId": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "SSHKey"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SSHKeySpecDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SecretFile"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SecretFileSpecDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SecretText"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SecretTextSpecDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "WinRmCredentials"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/WinRmCredentialsSpecDTO"
              }
            }
          }
        }
      ]
    },
    "SecretFileSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SecretSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "secretManagerIdentifier"
          ],
          "properties": {
            "additionalMetadata": {
              "$ref": "#/definitions/AdditionalMetadata"
            },
            "secretManagerIdentifier": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SecretRequestWrapper": {
      "type": "object",
      "required": [
        "secret"
      ],
      "properties": {
        "secret": {
          "$ref": "#/definitions/SecretDTOV2"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SecretSpecDTO": {
      "type": "object",
      "discriminator": "type",
      "properties": {
        "errorMessageForInvalidYaml": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SecretTextSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SecretSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "secretManagerIdentifier",
            "valueType"
          ],
          "properties": {
            "additionalMetadata": {
              "$ref": "#/definitions/AdditionalMetadata"
            },
            "secretManagerIdentifier": {
              "type": "string"
            },
            "value": {
              "type": "string"
            },
            "valueType": {
              "type": "string",
              "enum": [
                "Inline",
                "Reference",
                "CustomSecretManagerValues"
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TGTGenerationSpecDTO": {
      "type": "object",
      "discriminator": "tgtGenerationMethod",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TGTKeyTabFilePathSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/TGTGenerationSpecDTO"
        },
        {
          "type": "object",
          "properties": {
            "keyPath": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TGTPasswordSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/TGTGenerationSpecDTO"
        },
        {
          "type": "object",
          "properties": {
            "password": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "WinRmAuthDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "NTLM",
            "Kerberos"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Kerberos"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KerberosWinRmConfigDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "NTLM"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NTLMConfigDTO"
              }
            }
          }
        }
      ]
    },
    "WinRmCommandParameter": {
      "type": "object",
      "properties": {
        "parameter": {
          "type": "string"
        },
        "value": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "WinRmCredentialsSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/SecretSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "auth"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/WinRmAuthDTO"
            },
            "parameters": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/WinRmCommandParameter"
              }
            },
            "port": {
              "type": "integer",
              "format": "int32"
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
  "resourceType": "secret",
  "scope": "org",
  "syncedAt": "2026-05-27T09:53:36.734Z",
  "accountId": "VpehPBwPQ9qKsX-xDP8SFg",
  "orgId": "default",
  "projectId": "aidevops"
};
