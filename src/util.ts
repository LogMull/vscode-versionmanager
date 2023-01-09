import * as vscode from 'vscode';
const axios = require('axios');
const fs = require('fs');
const https = require('https');

const extId = "intersystems-community.servermanager";
let extension = vscode.extensions.getExtension(extId);
const serverManagerApi = extension.exports;
// Given a file URI, determine if it is valid to add to a VM task
export function verifyFileURI(fileURI: vscode.Uri): { "validForTask": boolean,"validForSymbol":boolean, "elName": string, "elType": string, "validationMessage": string } {
    let retVal = {
        validForTask: false,
        validForSymbol:false,
        elName: "",
        elType: "",
        validationMessage: ""
    }
    // The current file can only be added if it actually one of our files.
    // If the uri's scheme is not isfs, it is not one of ours
    if (fileURI.scheme !== 'isfs') {
        // LCM need a better message here, but this works for now
        retVal.validForTask = false;
        retVal.validationMessage = "Current file scheme is not isfs, unable to add to VM task."

    } else {
        retVal.validForTask = true;
        retVal.validForSymbol=true;
        // If the file belongs to ISFS, it came from our server, so figure out what it is
        retVal.elName = fileURI.path.slice(1, -4); // All file names start with / which is not what we need, also strip off the extension
        retVal.elName = retVal.elName.replace(/\//g, "."); // replace os/web/com/ to os.web.com
        if (fileURI.path.endsWith('.cls')) {
            retVal.elType = "SYCLASS";
        } else if (fileURI.path.endsWith('.mac')) {
            retVal.elType = "SYR"
        } else if (fileURI.path.endsWith('.inc')) {
            retVal.elType = "SYI"
        } else if (fileURI.path.endsWith('.int')) {
            // .int cannot be added to a task, but may be parsed
            retVal.validForTask=false;
        } else {
            retVal.validForTask = false;
            retVal.validForSymbol=false;
            retVal.validationMessage = 'Only .cls, .mac, or .inc files may be added to a VM task.'
            return retVal;
        }
    }
    return retVal
}

// Determine the most recent version of the plugin on the server.  If there is a newer version than our current one, download and install it
export async function checkForUpdates(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel,automatic=true) { 
    const serverInfo = await getServerInfo();
    const cacheUser: string = serverInfo.cacheUser;
    const cachePassword: string = serverInfo.cachePassword;
    const currVer = context.extension.packageJSON.version;
    const url = `${serverInfo.server.scheme}://${serverInfo.server.host}/csp/vm/RestAPI/vm/vsCodeExt/getMostRecentVersion?version=${context.extension.packageJSON.version}`;
    // const url = `${serverInfo.server.scheme}://${serverInfo.server.host}/csp/vm/RestAPI/vm/vsCodeExt/getMostRecentVersion?version=0.0.6`; // For testing
    console.log(url)
    axios({
        method: 'get',
        'url': url,
        'repsonseType': 'json',
        auth: {
            username: cacheUser,
            password: cachePassword
        }
    })
        .then(async (restResponse) => {
            if (restResponse.data.newVersionAvailable){
                const token = restResponse.data.tokenId;
                const message = `New version of VM Tools available.  Check output for details.`
                outputChannel.appendLine(`Current Version: ${currVer}\nAvailable: ${restResponse.data.newestVersion}`);
                const downloadAndInstall = 'Download and Install';
                const answer = await vscode.window.showWarningMessage(`${message}`, {}, downloadAndInstall);
                let fileName = 'osc-versionmanagerLatest.vsix';
                // If the user selected to download and install do so
                if (answer == downloadAndInstall) {
                    const url = `https://${serverInfo.server.host}/csp/vm/RestAPI/vm/vsCodeExt/downloadFile?tokenId=${token}`;
                    const authStr = cacheUser + ':' + cachePassword
                    const options = {
                        host: `${serverInfo.server.host}`,
                        port: 443,
                        path: `/csp/vm/RestAPI/vm/vsCodeExt/downloadFile?tokenId=${token}`,
                        // authentication headers
                        headers: {
                            'Authorization': 'Basic ' + Buffer.from(authStr).toString('base64')
                        }
                    }
                    // Request the document from the server
                    https.get(options, (res) =>{
                        // Write the file to disk
                        const file = fs.createWriteStream('./'+fileName);
                        res.pipe(file);
                        // when the file pipe finishes, write the file and install the plugin
                        file.on('finish',async () =>{
                            file.close();
                            const uri = vscode.Uri.file(`${process.cwd()}/${fileName}`);
                            await vscode.commands.executeCommand('workbench.extensions.installExtension', uri);
                            // Prompt the user for reloading the window
                            if (await consentToReload()) {
                                vscode.commands.executeCommand('workbench.action.reloadWindow');
                            }
                        })
                    })                   
                }
            }else{
                if (!automatic){
                    vscode.window.showInformationMessage(`VM Tools is up to date (version ${currVer})`);
                }
                // If no version is available, output the results
                outputChannel.appendLine(`Plugin is up to date (version ${currVer}`);
            }
        })
        .catch((response) => handleRejectedAPI(response, outputChannel));

    }
/// Get the server information for the currently opened workspace
  export async function getServerInfo() {
        const configuration = vscode.workspace.getConfiguration('versionmanager');
        // Not likely to be a large impact, but always get the settings for every call so that updates are immediately reflected.
        const currentUser: string = configuration.get('request.user');
        const server: string = configuration.get('serverName');

        const serverSpec = await serverManagerApi.getServerSpec(server);
        // Get the password from the user...
        await resolvePassword(serverSpec)
        const cacheUser: string = serverSpec.username
        const cachePassword: string = serverSpec.password

        return {
            artivaUser: currentUser,
            serverName: server,
            cacheUser: cacheUser,
            cachePassword: cachePassword,
            server: serverSpec.webServer
        }
    }
async function resolvePassword(serverSpec): Promise<void> {
    const AUTHENTICATION_PROVIDER = "intersystems-server-credentials";
    // This arises if setting says to use authentication provider
    if (typeof serverSpec.password === "undefined") {
        const scopes = [serverSpec.name, serverSpec.username || ""];
        let session = await vscode.authentication.getSession(AUTHENTICATION_PROVIDER, scopes);
        if (!session) {
            session = await vscode.authentication.getSession(AUTHENTICATION_PROVIDER, scopes, { createIfNone: true });
        }
        if (session) {
            // If original spec lacked username use the one obtained by the authprovider
            serverSpec.username = serverSpec.username || session.scopes[1];
            serverSpec.password = session.accessToken;
        }
    }
}
/// Common handler for when a rest request is rejected.
export function handleRejectedAPI(response, outputChannel?) {
    const respObj = response.toJSON();
    let message: string = respObj.message
    if (respObj.status === 401) {
        message = 'Request failed with status of 401, check you settings for the cacheUser and cachePassword.';
    }
    else if (respObj.status === 404) {
        message = 'Request failed with a status of 404 - could not find ' + respObj.config.url;
    }

    vscode.window.showErrorMessage(message);
    if (outputChannel){
        outputChannel.appendLine(message);
        outputChannel.appendLine('');
    }
}

    /**
     * Requests user confirmation to reload the installed extension
     */
    async function consentToReload() {
    const reload = 'Reload';
    const answer = await vscode.window.showWarningMessage(`New version of VM Tools was installed.`, {}, reload, 'Later');
    return answer === reload;
    }

