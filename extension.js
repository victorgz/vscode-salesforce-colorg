// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const watchers = [];
const OLD_PATH = '**/.sfdx/sfdx-config.json';
const NEW_PATH = '**/.sf/config.json';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

async function activate() {
	const handleFileContent = (uri) => {
		const file = requireUncached(path.resolve(uri.fsPath));
		const conf = vscode.workspace.getConfiguration();

		const targets = conf.get('sf-colorg.rules') || [];
		let targetColor = null;
		let targetForeground = null;
		for (let target of targets) {
			const attribute = uri.fsPath.includes('/.sfdx/')
				? 'defaultusername'
				: 'target-org';

			if (new RegExp(target.regex).test(file[attribute])) {
				targetColor = target.color;
				targetForeground = target.foreground;
				break;
			}
		}
		setColor(targetColor, targetForeground);
	};

	const init = async () => {
		// Initial setup
		try {
			await initialCleanup();
			let files = await vscode.workspace.findFiles(NEW_PATH, null, 1);

			if (files.length > 0) {
				handleFileContent(files[0]);
			} else {
				files = await vscode.workspace.findFiles(OLD_PATH, null, 1);

				if (files.length > 0) {
					handleFileContent(files[0]);
				}
			}
		} catch (err) {
			console.error(err);
		}
	};

	init();

	// Config change listener
	vscode.workspace.onDidChangeConfiguration((changeConfigEvent) => {
		if (changeConfigEvent.affectsConfiguration('sf-colorg')) {
			init();
		}
	});

	// File change watcher
	let oldPathFile = await vscode.workspace.findFiles(OLD_PATH, null, 1);
	if (oldPathFile.length > 0) {
		watchers.push(
			vscode.workspace.createFileSystemWatcher(
				path.resolve(oldPathFile[0].fsPath)
			)
		);
	}
	let newPathFiles = await vscode.workspace.findFiles(NEW_PATH, null, 1);
	if (newPathFiles.length > 0) {
		watchers.push(
			vscode.workspace.createFileSystemWatcher(
				path.resolve(newPathFiles[0].fsPath)
			)
		);
	}

	// Event listener
	watchers.forEach((watcher) => {
		watcher.onDidChange((uri) => handleFileContent(uri));
		watcher.onDidCreate((uri) => handleFileContent(uri));
	});
}

function getRelativeLuminance(hex) {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const [rs, gs, bs] = [r, g, b].map((c) =>
		c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
	);
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

async function setColor(color, foreground) {
	const config = vscode.workspace.getConfiguration();
	const colorCustomizations = config.get('workbench.colorCustomizations');
	const statusBar = config.get('sf-colorg.target.statusBar');
	const activityBar = config.get('sf-colorg.target.activityBar');

	let fg = foreground;
	if (color && !fg) {
		fg = getRelativeLuminance(color) > 0.4 ? '#000000' : '#FFFFFF';
	}

	if (statusBar || color == null) {
		colorCustomizations['statusBar.background'] = color;
		colorCustomizations['statusBar.foreground'] =
			color != null ? fg : undefined;
	} else {
		colorCustomizations['statusBar.background'] = undefined;
		colorCustomizations['statusBar.foreground'] = undefined;
	}

	if (activityBar || color == null) {
		colorCustomizations['activityBar.background'] = color;
		colorCustomizations['activityBar.foreground'] =
			color != null ? fg : undefined;
	} else {
		colorCustomizations['activityBar.background'] = undefined;
		colorCustomizations['activityBar.foreground'] = undefined;
	}

	await vscode.workspace
		.getConfiguration()
		.update(
			'workbench.colorCustomizations',
			colorCustomizations,
			vscode.ConfigurationTarget.Workspace
		);
}

// Remove previous color customizations to avoid color blinking when switching to an unknown config
async function initialCleanup() {
	const config = vscode.workspace.getConfiguration();
	const colorCustomizations = config.get('workbench.colorCustomizations');

	colorCustomizations['statusBar.background'] = undefined;
	colorCustomizations['statusBar.foreground'] = undefined;
	colorCustomizations['activityBar.background'] = undefined;
	colorCustomizations['activityBar.foreground'] = undefined;

	return vscode.workspace
		.getConfiguration()
		.update(
			'workbench.colorCustomizations',
			colorCustomizations,
			vscode.ConfigurationTarget.Global
		);
}

function requireUncached(module) {
	delete require.cache[require.resolve(path.resolve(module))];
	return require(path.resolve(module));
}

// This method is called when your extension is deactivated
async function deactivate() {
	watchers.forEach((watcher) => {
		watcher.dispose();
	});
	setColor(null);
}

module.exports = {
	activate,
	deactivate,
};
