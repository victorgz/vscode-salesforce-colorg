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
	/**
	 *
	 * @param {string} uri - file uri of the config file
	 */
	const handleFileContent = (uri) => {
		const file = requireUncached(path.resolve(uri.fsPath));
		const conf = vscode.workspace.getConfiguration();

		const targets = conf.get('sf-colorg.rules') || [];

		// Setting as undefined to keep the settings files a bit cleaner
		let targetBackgroundColor = undefined;
		let targetForegroundColor = undefined;
		for (let target of targets) {
			const attribute = uri.fsPath.includes('/.sfdx/')
				? 'defaultusername'
				: 'target-org';

			if (new RegExp(target.regex).test(file[attribute])) {
				targetBackgroundColor = target.color;
				targetForegroundColor = target.foregroundColor;
				break;
			}
		}
		setColor(targetBackgroundColor, targetForegroundColor);
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
				} else {
					setColor(undefined, undefined);
				}
			}
		} catch (err) {
			console.error(err);
		}
	};

	const handleInit = async () => {
		try {
			await init();
		} catch (err) {
			console.error(err);
		}
	};

	handleInit();

	vscode.workspace.onDidChangeConfiguration((changeConfigEvent) => {
		if (changeConfigEvent.affectsConfiguration('sf-colorg')) {
			handleInit();
		}
	});

	vscode.window.onDidChangeWindowState(async () => {
		if (!vscode.window.state.focused) {
			setColor();
		} else {
			handleInit();
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

/**
 *
 * @param {string} backgroundColor - hex color code for background color
 * @param {string} [foregroundColor] - hex color code for foreground color (Optional)
 */
async function setColor(backgroundColor, foregroundColor) {
	const config = vscode.workspace.getConfiguration();
	const settingsScope =
		config.get('sf-colorg.target.settingsScope') || 'workspace';
	const target =
		settingsScope === 'workspace'
			? vscode.ConfigurationTarget.Workspace
			: vscode.ConfigurationTarget.Global;
	const newColorCustomizations = { ...colorCustomizations };

	if (backgroundColor) {
		if (statusBar) {
			newColorCustomizations['statusBar.foreground'] = foregroundColor;
			newColorCustomizations['statusBar.background'] = backgroundColor;
		}

		if (activityBar) {
			newColorCustomizations['activityBar.inactiveForeground'] =
				foregroundColor;
			newColorCustomizations['activityBar.background'] = backgroundColor;
		}
	}

	await vscode.workspace
		.getConfiguration()
		.update(
			'workbench.colorCustomizations',
			newColorCustomizations,
			target
		);
}

// Remove previous color customizations to avoid color blinking when switching to an unknown config
async function initialCleanup() {
	const config = vscode.workspace.getConfiguration();
	const settingsScope =
		config.get('sf-colorg.target.settingsScope') || 'workspace';
	const target =
		settingsScope === 'workspace'
			? vscode.ConfigurationTarget.Workspace
			: vscode.ConfigurationTarget.Global;
	const colorCustomizations = config.get('workbench.colorCustomizations');

	colorCustomizations['statusBar.foreground'] = undefined;
	colorCustomizations['statusBar.background'] = undefined;
	colorCustomizations['activityBar.inactiveForeground'] = undefined;
	colorCustomizations['activityBar.background'] = undefined;

	return vscode.workspace
		.getConfiguration()
		.update('workbench.colorCustomizations', colorCustomizations, target);
}

function requireUncached(module) {
    delete require.cache[require.resolve(module)];
    return require(module);
}

// This method is called when your extension is deactivated
async function deactivate() {
	watchers.forEach((watcher) => {
		watcher.dispose();
	});
	setColor(undefined, undefined);
}

module.exports = {
	activate,
	deactivate,
	setColor,
	initialCleanup,
};
