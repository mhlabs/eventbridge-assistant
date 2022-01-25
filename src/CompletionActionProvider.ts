/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as jp from "jsonpath";
import { TemplateParser } from "./util/TamplateParser";
import * as filterTypes from "./schema/filterTypes.json";
import { SchemasUtil } from "./util/SchemasUtil";
const jsondiffpatch = require("jsondiffpatch").create();
const schemas = new SchemasUtil();
export class CompletionActionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<
    | vscode.CompletionItem[]
    | vscode.CompletionList<vscode.CompletionItem>
    | null
    | undefined
  > {
    let resourceName = getResourceName(position, document);
    const template = TemplateParser.parse(document.getText());
    if (!template) {
      return { items: [], isIncomplete: true };
    }
    const resource = template.Resources[resourceName];
    if (resource) {
      // Get and cache schema names
      await schemas.getSchemas("aws.events");
      await schemas.getSchemas("discovered-schemas");

      // Get registry based on EventBusName
      const registryName = schemas.getRegistry(resource);

      const schemaKeySuggestions = this.schemaKeysSuggestions(
        document,
        position,
        registryName,
        resource
      );
      if (schemaKeySuggestions) {
        return schemaKeySuggestions;
      }

      let { source, detailType }: { source: string; detailType: string } =
        schemas.getSchemaKeys(resource);

      const jsonPath = this.estimateJsonPath(
        resource,
        document.getText(),
        position.line
      );
      let pathSplit = jsonPath?.split("Properties.Pattern.");
      if (pathSplit.length === 1) {
        pathSplit = jsonPath?.split("Properties.EventPattern.");
      }
      const pathList = pathSplit.length > 1 ? pathSplit[1].split(".") : [];
      const schema = await schemas.getSchema(source, detailType, registryName);

      let schemaPath = schema.components.schemas.AWSEvent.properties;
      let isLeaf = false;

      ({ schemaPath, isLeaf } = schemas.navigateSchema(
        pathList,
        schemaPath,
        schema,
        isLeaf
      ));

      const schemaKeys = Object.keys(schemaPath);
      if (isLeaf) {
        const suggestions = filterTypes.map((key) => ({
          label: key.name,
		  sortText: " " + key,
		  filterText: `- ${key}`,
          insertText: `- ${key.name}${key.newLine ? ":\n\t- " : ": "}`,
          kind: vscode.CompletionItemKind.Event,
          range: this.getSuggestionRange(position, document),
        }));
        return { items: suggestions, isIncomplete: true };
      }
      const suggestions = schemaKeys.map((key) => ({
        label: key,
		sortText: " " + key,
        insertText: key + ":\n\t",
        kind: vscode.CompletionItemKind.Field,
        range: this.getSuggestionRange(position, document),
      }));
      return { items: suggestions, isIncomplete: true };
    }

    return { items: [], isIncomplete: true };
  }

  schemaKeysSuggestions(
    document: vscode.TextDocument,
    position: vscode.Position,
    registryName: string | null,
    resource: any
  ) {
    if (!registryName) {
      return null;
    }
    if (this.previousLine(document, position) === "source") {
      const suggestions = this.sources(position, document, 0, registryName);
      return { items: suggestions, isIncomplete: true };
    }

    if (this.previousLine(document, position) === "detail-type") {
      const source = jp.query(resource, "$..source");
      const suggestions = this.detailTypes(
        position,
        document,
        1,
        source[0][0],
        registryName
      );
      return { items: suggestions, isIncomplete: true };
    }
  }

  private previousLine(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    return this.getJsonPropertyName(document.getText(), position.line - 1);
  }

  private getSuggestionRange(
    position: vscode.Position,
    document: vscode.TextDocument
  ) {
    return new vscode.Range(
      position.line,
      getStartChar(
        document.getText(
          new vscode.Range(position.line, 0, position.line, position.character)
        )
      ).startChar,
      position.line,
      position.character
    );
  }

  private sources(
    position: vscode.Position,
    document: vscode.TextDocument,
    index: number,
    registryName: string
  ) {
    const sources = [
      ...new Set(
        schemas.schemaNames[registryName].map((p) => p.split("@")[index])
      ),
    ];
    const suggestions = sources.map((key) => ({
      label: `${key}`,
	  sortText: " " + key,
      filterText: `- ${key}`,
      insertText: `- ${key}\n`,
      kind: vscode.CompletionItemKind.Event,
      data: key,
      range: this.getSuggestionRange(position, document),
    }));
    return suggestions;
  }

  private detailTypes(
    position: vscode.Position,
    document: vscode.TextDocument,
    index: number,
    filter: string,
    registryName: string
  ) {
    const detailTypes = [
      ...new Set(
        schemas.schemaNames[registryName]
          .filter((p) => p.split("@")[0] === filter)
          .map((p) =>
            registryName === "aws.events"
              ? p
                  .split("@")
                  [index].replace(/([A-Z]+)/g, " $1")
                  .replace(/^ /, "")
              : p.split("@")[index]
          )
      ),
    ];
    const suggestions = detailTypes.map((key) => ({
      label: `${key}`,
	  sortText: " " + key,
      filterText: `- ${key}`,
      insertText: `- ${key}\n`,
      kind: vscode.CompletionItemKind.Event,
      data: key,
      range: this.getSuggestionRange(position, document),
    }));
    return suggestions;
  }

  getJsonPropertyName(document: string, line: number) {
    const lines = document.split("\n");
    return lines[line].trim().replace(":", "");
  }

  estimateJsonPath(resource: any, document: string, line: number) {
    const lines = document.split("\n");
    const currentStartChar = getStartChar(lines[line]).startChar;
    let previousRow;
    for (let i = line; i >= 0; i--) {
      if (getStartChar(lines[i]).startChar < currentStartChar) {
        previousRow = lines[i].trim().replace(":", "");
        break;
      }
    }
    console.log("previousRow", previousRow);
    const query = jp.nodes(resource, `$..["${previousRow}"]`);
    console.log("query", query);
    return query[0].path.join(".");
  }

  getJsonPath(oldResource: any, resource: any) {
    const diff = jsondiffpatch.diff(oldResource, resource);

    let jsonPath = pathDiff(diff)[0];
    console.log("jsonpath", jsonPath);
    if (!jsonPath) {
      return null;
    }
    const leafItem = jp.query(resource, jsonPath)[0];
    if (typeof leafItem === "object" && leafItem) {
      jsonPath += `.${Object.keys(leafItem)[0]}`;
    }
    return jsonPath;
  }
}

function pathDiff(obj: any, path?: string): string[] {
  if (!obj) {
    return [];
  }
  path = path || "$";
  //console.log(path);
  let item: string[] = [];
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      item.push(...pathDiff(obj[key], `${path}.${key}`));
    } else {
      item.push(`${path}.${key}`);
    }
  });
  return item;
}

function getStartChar(previousRow: string): any {
  const trimmed = previousRow.trimStart();
  const startChar = previousRow.length - trimmed.length;
  return { startChar, trimmed };
}

function getResourceName(
  position: vscode.Position,
  document: vscode.TextDocument
) {
  let line = position.line;
  let info: string = "";
  let previousStartChar = 10000;
  let resourceName;
  while (true) {
    line--;
    if (line === 1) break;
    const previousRow = document
      .getText(new vscode.Range(line, 0, line, 10000))
      .trimEnd();
    const { startChar, trimmed } = getStartChar(previousRow);
    info = trimmed;
    console.log(startChar, previousRow);
    if (startChar < 4 && trimmed.endsWith(":")) {
      resourceName = info.trim().replace(":", "");
      break;
    } else if (startChar === 0 && trimmed === "Resources:") break;
    if (trimmed.length && !trimmed.startsWith("#")) {
      previousStartChar = startChar;
      resourceName = trimmed.replace(":", "");
    }
  }

  return resourceName;
}
