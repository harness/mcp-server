// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v1/inputSet.json
// @ts-nocheck

const schema: Record<string, any> = {
  "type": "object",
  "title": "inputSet_v1",
  "additionalProperties": false,
  "required": [
    "version",
    "name"
  ],
  "properties": {
    "version": {
      "description": "Version defines the schema version.",
      "type": "number",
      "enum": [
        1
      ]
    },
    "name": {
      "description": "Name of the input set. The identifier is derived from it.",
      "type": "string",
      "minLength": 1
    },
    "inputs": {
      "description": "Map of pipeline input name to value. Keys are pipeline-specific and are validated at merge time, not here.",
      "type": "object"
    },
    "spec": {
      "$ref": "#/definitions/inputSet/overlay_spec"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "inputSet": {
      "overlay_spec": {
        "title": "overlay_spec",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "input_sets": {
            "description": "Identifiers of the input sets composed by this overlay input set.",
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  }
};
export default schema;
