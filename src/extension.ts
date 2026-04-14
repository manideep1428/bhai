import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';

let audioPath: string;
let currentProcess: ChildProcess | null = null;

function playSound() {
	// Kill previous playback
	if (currentProcess) {
		currentProcess.kill();
		currentProcess = null;
	}

	currentProcess = spawn('powershell', [
		'-NoProfile',
		'-Command',
		`Add-Type -AssemblyName presentationCore;
		$p = New-Object System.Windows.Media.MediaPlayer;
		$p.Open([uri]'${audioPath}');
		Start-Sleep -Milliseconds 300;
		$p.Play();
		Start-Sleep -Milliseconds 5000;`
	], { windowsHide: true });

	currentProcess.on('close', () => {
		currentProcess = null;
	});
}

export function activate(context: vscode.ExtensionContext) {
	audioPath = path.join(context.extensionPath, 'audio.mp3').replace(/\\/g, '/');

	console.log('bhai extension active, audio path:', audioPath);

	const listener = vscode.workspace.onDidChangeTextDocument((event) => {
		for (const change of event.contentChanges) {
			const text = change.text;

			// Skip enter (newline) and backspace (empty string with range deletion)
			const isEnter = text === '\n' || text === '\r\n' || text === '\r';
			const isBackspace = text === '' && change.rangeLength > 0;

			if (isEnter || isBackspace) {
				continue;
			}

			playSound();
			break; // only need to trigger once per change event
		}
	});

	context.subscriptions.push(listener);
}

export function deactivate() {
	if (currentProcess) {
		currentProcess.kill();
		currentProcess = null;
	}
}
