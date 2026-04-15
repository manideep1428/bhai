import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
	const audioPath = path.join(context.extensionPath, 'audio.mp3');

	// Read the audio file as base64 once — the webview will decode it into
	// an AudioBuffer so every subsequent play is instant (no process spawn).
	const audioBase64 = fs.readFileSync(audioPath).toString('base64');

	// Hidden webview — the user never sees it, it just runs the Web Audio API
	panel = vscode.window.createWebviewPanel(
		'bhaiAudio',
		'bhai audio',
		{ viewColumn: vscode.ViewColumn.One, preserveFocus: true },
		{
			enableScripts: true,
			retainContextWhenHidden: true,
		}
	);

	// Move the webview out of sight immediately
	// (VS Code doesn't allow truly hidden panels, but we can keep focus on the editor)
	vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');

	panel.webview.html = getWebviewHtml(audioBase64);

	// Trigger a play by posting a message to the webview
	const playSound = () => {
		panel?.webview.postMessage({ command: 'play' });
	};

	console.log('bhai extension active — using Web Audio API for zero-latency sound');

	const listener = vscode.workspace.onDidChangeTextDocument((event) => {
		for (const change of event.contentChanges) {
			const text = change.text;

			const isEnter = text === '\n' || text === '\r\n' || text === '\r';
			const isBackspace = text === '' && change.rangeLength > 0;

			if (isEnter || isBackspace) { continue; }

			playSound();
			break;
		}
	});

	context.subscriptions.push(listener);
	context.subscriptions.push({
		dispose: () => {
			panel?.dispose();
			panel = undefined;
		}
	});
}

function getWebviewHtml(audioBase64: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>bhai audio</title></head>
<body>
<script>
(async () => {
	const ctx = new AudioContext();

	// Decode MP3 once from the embedded base64 data
	const b64 = "${audioBase64}";
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }

	let buffer;
	try {
		buffer = await ctx.decodeAudioData(bytes.buffer);
	} catch(e) {
		console.error('bhai: failed to decode audio', e);
		return;
	}

	// Listen for play commands from the extension
	window.addEventListener('message', (event) => {
		if (event.data?.command !== 'play') { return; }

		// Resume AudioContext if suspended (browser autoplay policy)
		const play = () => {
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.connect(ctx.destination);
			source.start(0);
		};

		if (ctx.state === 'suspended') {
			ctx.resume().then(play);
		} else {
			play();
		}
	});
})();
</script>
</body>
</html>`;
}

export function deactivate() {
	panel?.dispose();
	panel = undefined;
}

