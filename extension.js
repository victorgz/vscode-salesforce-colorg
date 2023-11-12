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

	// Event listener for when the window is focused
	vscode.window.onDidChangeWindowState(async () => {
		const config = vscode.workspace.getConfiguration();

		if (
			!vscode.window.state.focused &&
			config.get('sf-colorg.target.settingsScope') === 'user'
		) {
			const isASfProject = await checkIfInSfProject();
			// If the focused window is confirmed to be a SF project
			if (isASfProject) {
				init();
			} else {
				setColor(undefined, undefined);
			}
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
 * Checks if the active editor is in a Salesforcxe project
 * @returns {boolean} true if the active editor is in a Salesforce project
 */
async function checkIfInSfProject() {
	const sfdxConfigFiles = await vscode.workspace.findFiles(
		OLD_PATH || NEW_PATH,
		null,
		1
	);

	if (sfdxConfigFiles.length > 0) {
		return true;
	}
	return false;
}

/**
 *
 * @param {string} backgroundColor - hex color code for background color
 * @param {string} [foregroundColor] - hex color code for foreground color (Optional)
 */
async function setColor(backgroundColor, foregroundColor) {
	const config = vscode.workspace.getConfiguration();
	const colorCustomizations = config.get('workbench.colorCustomizations');
	const statusBar = config.get('sf-colorg.target.statusBar');
	const activityBar = config.get('sf-colorg.target.activityBar');
	const colorSettingsTarget = getSettingsScope(config);

	if (backgroundColor === undefined) {
		// remove color settings entries
		colorCustomizations['statusBar.foreground'] = undefined;
		colorCustomizations['statusBar.background'] = undefined;
	}
	if (statusBar) {
		colorCustomizations['statusBar.foreground'] = foregroundColor;
		colorCustomizations['statusBar.background'] = backgroundColor;
	} else {
		colorCustomizations['statusBar.foreground'] = undefined;
		colorCustomizations['statusBar.background'] = undefined;
	}

	if (activityBar) {
		colorCustomizations['activityBar.inactiveForeground'] = foregroundColor;
		colorCustomizations['activityBar.background'] = backgroundColor;
	} else {
		colorCustomizations['activityBar.inactiveForeground'] = undefined;
		colorCustomizations['activityBar.background'] = undefined;
	}

	await vscode.workspace
		.getConfiguration()
		.update('workbench.colorCustomizations', colorCustomizations, colorSettingsTarget);
}

// Remove previous color customizations to avoid color blinking when switching to an unknown config
async function initialCleanup() {
	const config = vscode.workspace.getConfiguration();
	const target = getSettingsScope(config);

	if (target === vscode.ConfigurationTarget.Global) {
		const colorCustomizations = config.get('workbench.colorCustomizations');

		colorCustomizations['statusBar.foreground'] = undefined;
		colorCustomizations['statusBar.background'] = undefined;
		colorCustomizations['activityBar.inactiveForeground'] = undefined;
		colorCustomizations['activityBar.background'] = undefined;

		return config.update(
			'workbench.colorCustomizations',
			colorCustomizations,
			target
		);
	}
}

/**
 * Returns the configuration target for the settings scope in which color changes will be added 
 * in specified in the extensions configuration.
 * Defaults to 'Global' if not specified.
 * 
 * @param {vscode.WorkspaceConfiguration} config - workspace configuration object
 * @returns {vscode.ConfigurationTarget} - color settings target
 */
function getSettingsScope(config) {
	// default to 'user' if setting is absent
	let settingsScope = config.get('sf-colorg.target.settingsScope') || 'user';

	if (settingsScope === 'workspace') {
		// workspace settings
		return vscode.ConfigurationTarget.Workspace;
	}
	// user settings
	return vscode.ConfigurationTarget.Global;
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
	setColor(undefined, undefined);
}

module.exports = {
	activate,
	deactivate,
};
