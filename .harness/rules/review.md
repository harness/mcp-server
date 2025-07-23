1. Ensure the names of tools are not ambiguous and do not conflict with existing names
2. Ensure the descriptions are clear and suggest better descriptions if not well written. Ensure descriptions are not ambiguous.
3. Analyze the parameters for the tools and look for parameters which are machine data that will be hard for LLMs to interpret
4. Whenever you see request parameter fields in tool handlers which are strings with defined values, suggest to use `mcp.Enum` to track those.
5. Make sure we use defined methods like `mcp.NewToolResultError` to return errors from functions that return `mcp.CallToolRequest` 
