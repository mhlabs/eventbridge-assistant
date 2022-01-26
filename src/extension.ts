process.env.AWS_SDK_LOAD_CONFIG = "1";
import * as vscode from "vscode";
import { PatternCompletionActionProvider } from "./PatternCompletionActionProvider";
import * as AWS from "aws-sdk";
import { SingleSignOnCredentials } from "@mhlabs/aws-sdk-sso";
import { InputPathCompletionActionProvider } from "./InputPathCompletionActionProvider";
import { InputTemplateCompletionActionProvider } from "./InputTemplateCompletionActionProvider";
import { InputPathsMapCompletionActionProvider } from "./InputPathsMapCompletionActionProvider";
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
  "eventbridge-assistant"
);
export async function activate(context: vscode.ExtensionContext) {
  try {
    await authenticate();
  } catch (err: any) {
    await vscode.window.showErrorMessage(err);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("eventbridge-assistant.enable", () => {
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new PatternCompletionActionProvider(),
		""
      );
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new InputPathCompletionActionProvider(),
        "."
      );
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new InputPathsMapCompletionActionProvider(),
        "."
      );
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new InputTemplateCompletionActionProvider(),
		"<"
      );
    })
  );

  await vscode.commands.executeCommand("eventbridge-assistant.enable");
}

async function authenticate(profile?: any) {
  try {
    process.env.AWS_PROFILE =
      profile || (await config.get("AWSProfile")) || "default";
    AWS.config.credentialProvider?.providers.unshift(
      new SingleSignOnCredentials()
    );
  } catch (err: any) {
    await vscode.window.showWarningMessage(err);
    console.log(err);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
