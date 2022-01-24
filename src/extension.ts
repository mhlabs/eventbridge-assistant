process.env.AWS_SDK_LOAD_CONFIG = "1";
import * as vscode from "vscode";
import { CompletionActionProvider } from "./CompletionActionProvider";
import * as AWS from "aws-sdk";
import { SingleSignOnCredentials } from "@mhlabs/aws-sdk-sso";
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
  "eventbridge-assistant"
);
export async function activate(context: vscode.ExtensionContext) {
  try {
    await authenticate();
  } catch (err: any) {
    await vscode.window.showErrorMessage(err);
  }

  let disposable = vscode.commands.registerCommand(
    "eventbridge-assistant.enable",
    () => {
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new CompletionActionProvider()
      );
    }
  );
  context.subscriptions.push(disposable);
  await vscode.commands.executeCommand("eventbridge-assistant.enable");
}

async function authenticate(profile?: any) {
  try {
    process.env.AWS_PROFILE = profile || (await config.get("AWSProfile")) || "default";
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
