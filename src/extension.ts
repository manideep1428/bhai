import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';


let psProcess: ChildProcess | undefined;
let ready = false;

function startPowerShellPlayer(audioPath: string) {
	// Escape backslashes for PowerShell string
	const escapedPath = audioPath.replace(/\\/g, '\\\\');

	// Spawn a single PowerShell process that stays alive
	// -NonInteractive + reading from stdin keeps it resident
	psProcess = spawn('powershell.exe', [
		'-NoProfile',
		'-NonInteractive',
		'-ExecutionPolicy', 'Bypass',
		'-Command', '-'
	], {
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true,
	});

	psProcess.on('error', () => { psProcess = undefined; ready = false; });
	psProcess.on('exit', () => { psProcess = undefined; ready = false; });

	// Pre-load WMP COM object and the audio file into memory
	// After this runs, playing is instant — no disk I/O, no startup delay
	const initScript = `
Add-Type -AssemblyName presentationCore
$global:mp = New-Object System.Windows.Media.MediaPlayer
$global:mp.Open([uri]'${escapedPath}')
$global:mp.Volume = 1
Start-Sleep -Milliseconds 500
Write-Host 'READY'
`;

	psProcess.stdin!.write(initScript);

	// Wait for READY signal before accepting play commands
	psProcess.stdout!.on('data', (data: Buffer) => {
		if (data.toString().includes('READY')) {
			ready = true;
		}
	});
}

function playSound() {
	if (!psProcess || !ready) { return; }

	// Stop + seek to start + play — all in one line, no new process
	// MediaPlayer plays instantly since audio is already loaded in memory
	psProcess.stdin!.write(`$global:mp.Stop(); $global:mp.Position = [TimeSpan]::Zero; $global:mp.Play()\n`);
}

export function activate(context: vscode.ExtensionContext) {
	const audioPath = path.join(context.extensionPath, 'audio.mp3');

	console.log('bhai extension active — keep-alive PowerShell MediaPlayer');

	startPowerShellPlayer(audioPath);

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
			psProcess?.stdin?.end();
			psProcess?.kill();
			psProcess = undefined;
			ready = false;
		}
	});
}

export function deactivate() {
	psProcess?.stdin?.end();
	psProcess?.kill();
	psProcess = undefined;
	ready = false;
}
