// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const axios = require('axios');

let outputChannel: vscode.OutputChannel
let showKeyword="Show Output";
const configuration = vscode.workspace.getConfiguration('versionmanager');




// ---------------- Plugin core ----------------
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Version Manager Plugin is now active');
	outputChannel = vscode.window.createOutputChannel("Version Manager")
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('osc-versionmanager.addtotask', () => {
	//	return
		addCurrentFileToTask();
	});
	
	context.subscriptions.push(disposable);


	disposable = vscode.commands.registerCommand('osc-versionmanager.addalltotask', () => {
		checkOpenNamespaces();
	});
	context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
export function deactivate() { }

// ---------------- Main Methods ----------------

/// Add the current file to a task
function addCurrentFileToTask(){
	let currentFile: vscode.Uri;
	if (vscode.window.activeTextEditor){
		currentFile = vscode.window.activeTextEditor.document.uri
	}
	else {
		vscode.window.showErrorMessage("No current class or routine");
		return;
	}
	const valInfo = verifyFileURI(currentFile);
	if (!valInfo.valid){
		vscode.window.showErrorMessage(valInfo.validationMessage);
		return;
	}
	// Now get the authority of the current file, so we know where to pull tasks from
	const auth = getNamespaceFromURI(currentFile);
	// The file name and type are now known and valid, prompt the user for a list of tasks
	promptForTasks(auth).then((selection: { taskObj: { task: any; }; doShowAll: any; }) =>{
		if (!selection) return;
		console.log(selection)
		if (selection.doShowAll){
			promptForTasks(auth,true).then((selection: { taskObj: { task: any; }; }) => {
				addElementToTask(selection.taskObj.task,valInfo.elType,valInfo.elName);
			});
			return;
		}
		addElementToTask(selection.taskObj.task, valInfo.elType, valInfo.elName);
	})
	
}

// Show the user all of the open text editors and allow them to select what should be added to a task
function checkOpenNamespaces(){
// LCM 
// Get list of all tasks
// Verify they all belong to the same dev nsp, if not cancel
	// All elements must be added to the same task, however, each workspace can have multiple namespaces open at once
	// If this happens and different namespaces are open, we need to ensure that elements are only added to an appropriate task
	let namespaces={};
	let nsCnt=0;
	let lastNs="";

	// Build a reference of all of the open editors
	for (let doc of vscode.workspace.textDocuments) {
		let docUri =  doc.uri
		let valInfo = verifyFileURI(docUri);
		// If the document is not valid, skip it
		if (!valInfo.valid) continue;
		// Keep track of the namespace for each open document.  If there is more than one, a 2nd list will need to be shown
		let ns = getNamespaceFromURI(docUri)

		if (!namespaces[ns]){
			namespaces[ns]=[];
			nsCnt++;
			lastNs=ns; // Keep track of the last known NS - if there's only one, that will make it easier to reference later
		}
		namespaces[ns].push({"document":docUri,"valInfo":valInfo});
		
		
	}
	console.log("Open Namespaces, ", namespaces)
	// namespaces now contains all documents sorted by namespace.
	// If there are multiple namespaces, we need to know which one to select documents for
	if (nsCnt>1){
		let list =[];
		// Add each namespace to a list
		for (const ns in namespaces) {
			list.push({
				label: ns,
				uris:namespaces[ns]
				

			});
		}
		vscode.window.showQuickPick(list,
			{ placeHolder: 'Files from multiple namespaces open - select a namespace' }).
		then((nsObj)=>{
			selectFilesToAdd(nsObj.label,nsObj.uris);
		});
	}else{
		selectFilesToAdd(lastNs,namespaces[lastNs]);
	}
}
// Selection will be an array of objects that contain both the file URI and its validation information
function selectFilesToAdd(namespace:string,selection:[any]){
	// Now prompt the user for a list of elements to select
	let list = [];
	for (let file of selection){
		list.push({
			label: file.valInfo.elName,
			detail: file.valInfo.elType,
			info: file.valInfo
		})
	}
	vscode.window.showQuickPick(list,
		{ placeHolder: 'Select all elements to add.',canPickMany:true })
		.then((selected)=>{
			console.log(selected)
			promptForTasks(namespace).then((task: { doShowAll: any; taskObj: { task: any; }; })=>{
				if (task.doShowAll) {
					promptForTasks(namespace, true).then((selection: any) => {
						var message = `Adding the following to ${task.taskObj.task}`;
						outputChannel.appendLine(message)
						for (const el of selected) {
							outputChannel.appendLine(`${el.info.elType} ${el.info.elName}`);
						}
						vscode.window.showInformationMessage("Elements would be added, check output for details")//, showKeyword).then(selection => notificationClicked(selection))
					});
					return
				}
				var message = `Adding the following to ${task.taskObj.task}`;
				outputChannel.appendLine(message)
				for (const el of selected){
					outputChannel.appendLine(`${ el.info.elType } ${ el.info.elName }`);
				}
				vscode.window.showInformationMessage("Elements would be added, check output for details")//, showKeyword).then(selection => notificationClicked(selection))
			})

		});
}
// Prompt the user for a task to add elements to
function promptForTasks(namespace: string = "", allUsers = false) {
	// Not likely to be a large impact, but always get the settings for every call so that updates are immediately reflected.
	const currentUser: string = configuration.get('request.user');
	const cacheUser: string = configuration.get('server.cacheUser');
	const cachePassword: string = configuration.get('server.cachePassword');

	const incNew: boolean = configuration.get('request.includeNew');
	const incHold: boolean = configuration.get('request.includeHold');

	// Determine what user to send the request for.
	let user = currentUser;
	if (allUsers){
		// Empty string for the user id will get a list of tasks for all users
		user=' '
	}
	console.log(user)
	// Build the request URL
	const url = `https://dev.ber2012.com/vm/taskService/getTasks/${user}/${incNew?1:0}/${incHold?1:0}`;

	return axios({
		method: 'get',
		'url': url,
		'repsonseType': 'json',
		auth:{
			username:cacheUser,
			password:cachePassword
		}
	}) // LCM TODO - Add graceful rejection, likely due to credientials (401) or a server unreachable
		.then((response: { data: { children: any; }; }) => {
			let data = response.data.children;
			console.log(vscode.workspace.workspaceFolders);
			// If a namespace is provided, use it to filter
			// Otherwise, filter to all available namespaces in the workspace 
			let namespaces = [];
			if (namespace !== '') {
				namespaces.push(namespace)
			} else {
				// Get a list of all of the namespaces currently open in this workspace
				for (let workspace of vscode.workspace.workspaceFolders) {
					namespaces.push(getNamespaceFromURI(workspace.uri))
				}
			}
			console.log(`Namespaces: ${namespaces}`);
			let list = [];

			console.log("User:" + user)
			// Iterate over each task
			for (const task of data) {
				// LCM TODO - figure out what authority the current file has and match that
				if (!namespaces.includes(task.devNsp)) continue;
				list.push({
					"label": task.task + " - " + task.jira,
					"description": task.desc,
					"detail": task.owner + " " + task.devNsp,
					"taskObj": task
				})
			}
			// If the user is specified, show the option to show all users
			if (user.length) {
				list.push({
					"label": "See Tasks for All Users",
					"detail": "Showing only for " + user,
					"doShowAll": true
				})
			}

			return vscode.window.showQuickPick(list,
				{ placeHolder: 'Select a task.' });

		});


}
function promptForTasksOld(namespace: string = "", allUsers = false){
	
		return axios({method:'get',
		'url':"https://dev.ber2012.com/csp/vm/vm.web.service.csp.GetTasks.cls",
		'repsonseType':'json'})
		.then((response: { data: { children: any; }; })=>{
			let data = response.data.children;
			console.log(vscode.workspace.workspaceFolders);
			// If a namespace is provided, use it to filter
			// Otherwise, filter to all available namespaces in the workspace 
			let namespaces = [];
			if (namespace!==''){
				namespaces.push(namespace)
			}else{
				// Get a list of all of the namespaces currently open in this workspace
				for (let workspace of vscode.workspace.workspaceFolders) {
					namespaces.push(getNamespaceFromURI(workspace.uri))
				}
			}
			console.log(`Namespaces: ${namespaces}`);
			let list =[];
			let user:string="";
			if (!allUsers){
				user= vscode.workspace.getConfiguration('VersionManager').get("user");
			}
			console.log("User:" +user)
			// Iterate over each task
			for (const task of data){
				// Only show tasks that are in our active dev statuses
				if (!["NEW", "DEV", "QC", "QA"].includes(task.status) ) continue;
				// Filter tasks that do not share the same dev namespace as what we have listed
				// LCM TODO - figure out what authority the current file has and match that
				if (!namespaces.includes(task.devNsp)) continue;
				if (user.length && user!=task.asgTo && user!=task.owner) continue;
				list.push({
					"label": task.task + " - " + task.jira,
					"description": task.desc,
					"detail": task.owner + " " + task.devNsp,
					"taskObj":task
				})
			}
			// If the user is specified, show the option to show all users
			if (user.length){
				list.push({
					"label": "See Tasks for All Users",
					"detail": "Showing only for "+user,
					"doShowAll":true
				})
			}

			return vscode.window.showQuickPick(list,
				{ placeHolder: 'Select a task.' });
			
		});
		
		
	}

function addElementToTask(taskId: any,elType: string,elName: string):void{
	const currentUser: string = configuration.get('request.user');
	const cacheUser: string = configuration.get('server.cacheUser');
	const cachePassword: string = configuration.get('server.cachePassword');
	// Build the request URL
	const url = `https://dev.ber2012.com/vm/taskService/addElement/${currentUser}/${taskId}/${elType}/${elName}`;
	console.log(url)
	axios({
		method: 'post',
		'url': url,
		'repsonseType': 'json',
		auth: {
			username: cacheUser,
			password: cachePassword
		}
	}) // LCM TODO - Add graceful rejection, likely due to credientials (401) or a server unreachable
		.then((restResponse) => {
			const response = restResponse.data;
			console.log(response)
			if (response.isOk){
				outputChannel.appendLine(`${response.returnValue}`)
				vscode.window.showInformationMessage(`${response.returnValue}`)//, showKeyword).then(selection => notificationClicked(selection))
			}else{

			}
		})

}
// ---------------- Helpers ----------------

function getNamespaceFromURI(fileURI: vscode.Uri): string {
	return fileURI.authority.split(':')[1].toUpperCase();
}
// Given a file URI, determine if it is valid to add to a VM task
function verifyFileURI(fileURI: vscode.Uri): { "valid": boolean, "elName": string, "elType": string, "validationMessage": string } {
	let retVal = {
		valid: false,
		elName: "",
		elType: "",
		validationMessage: ""
	}
	// The current file can only be added if it actually one of our files.
	// If the uri's scheme is not isfs, it is not one of ours
	if (fileURI.scheme !== 'isfs') {
		// LCM need a better message here, but this works for now
		retVal.valid = false;
		retVal.validationMessage = "Current file scheme is not isfs, unable to add to VM task."

	} else {
		retVal.valid = true;
		// If the file belongs to ISFS, it came from our server, so figure out what it is
		retVal.elName = fileURI.path.slice(1, -4); // All file names start with / which is not what we need, also strip off the extension
		retVal.elName = retVal.elName.replace(/\//g, "."); // replace os/web/com/ to os.web.com
		if (fileURI.path.endsWith('.cls')) {
			retVal.elType = "SYCLASS";
		} else if (fileURI.path.endsWith('.mac')) {
			retVal.elType = "SYR"
		} else if (fileURI.path.endsWith('.inc')) {
			retVal.elType = "SYI"
		} else {
			retVal.valid = false;
			retVal.validationMessage = 'Only .cls, .mac, or .inc files may be added to a VM task.'
			return;
		}
	}
	return retVal
}

function notificationClicked(notificationValue: string){
	if (notificationValue == showKeyword) {
		outputChannel.show();
	}
}



