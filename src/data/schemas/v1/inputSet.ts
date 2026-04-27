// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v1/inputSet.json
// @ts-nocheck

const schema: Record<string, any> = {
  "type": "object",
  "title": "inputSet_v1",
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
      "description": "defines the kind of yaml (pipeline/template)",
      "type": "string",
      "enum": [
        "input-set"
      ]
    },
    "spec": {
      "type": "object",
      "description": "inputs to be used in the linked template",
      "additionalProperties": {
        "anyOf": [
          "string",
          "array",
          "list",
          "object",
          "boolean"
        ]
      },
      "propertyNames": {
        "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$-]{0,127}$"
      }
    }
  },
  "definitions": {}
};
export default schema;
