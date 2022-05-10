/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as jp from "jsonpath";
import { TemplateParser } from "./util/TamplateParser";
import * as filterTypes from "./schema/filterTypes.json";
import { SchemasUtil } from "./util/SchemasUtil";
export class InputTemplateCompletionActionProvider
  implements vscode.CompletionItemProvider
{
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
	token: vscode.CancellationToken,
	context: vscode.CompletionContext
  ): Promise<
    | vscode.CompletionItem[]
    | vscode.CompletionList<vscode.CompletionItem>
    | null
    | undefined
  > {
    const schemas = new SchemasUtil();
	
    let resourceName = SchemasUtil.getResourceName(position, document);
    const template = TemplateParser.parse(document.getText());
    if (!template) {
      return { items: [], isIncomplete: true };
    }
    const resource = template.Resources[resourceName];
    const path = SchemasUtil.estimateJsonPath(
      resource,
      document.getText(),
      position.line
    );
    const pathSplit = path.split(".");
    const current = SchemasUtil
      .getCurrentLine(document.getText(), position.line)
      .split(" ");
    if (
      pathSplit.slice(-1)[0] !== "InputTransformer" ||
      current[0] !== "InputTemplate"
    ) {
      return;
    }
    const mapKeys = Object.keys(jp.query(resource, path + ".InputPathsMap")[0]);
    const suggestions = mapKeys.map((key) => ({
      label: key,
      sortText: " " + key,
      insertText: `<${key}>`.replace(context.triggerCharacter || "", ""),
      kind: vscode.CompletionItemKind.Value,
    }));
    return { items: suggestions, isIncomplete: true };
  }
}
