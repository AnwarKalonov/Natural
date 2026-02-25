const vscode = require('vscode');

const getWebAppUrl = () => {
  const configured = vscode.workspace.getConfiguration('natural').get('appUrl');
  if (configured && typeof configured === 'string' && configured.trim()) {
    return configured.trim();
  }
  return process.env.NATURAL_WEB_URL || 'http://localhost:5173';
};

const openInBrowser = async (value) => {
  try {
    await vscode.env.openExternal(vscode.Uri.parse(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Natural: failed to open URL (${message}).`);
  }
};

const selectionToPrompt = (editor) => {
  if (!editor) return '';
  const selected = editor.document.getText(editor.selection).trim();
  if (!selected) return '';
  return encodeURIComponent(selected);
};

function activate(context) {
  const openApp = vscode.commands.registerCommand('natural.openApp', async () => {
    const url = getWebAppUrl();
    await openInBrowser(url);
  });

  const sendSelection = vscode.commands.registerCommand('natural.sendSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Natural: no active editor.');
      return;
    }

    const base = getWebAppUrl();
    const selection = selectionToPrompt(editor);
    const path = selection ? `/chat?prefill=${selection}` : '/chat';
    await openInBrowser(`${base.replace(/\/$/, '')}${path}`);
  });

  context.subscriptions.push(openApp, sendSelection);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
