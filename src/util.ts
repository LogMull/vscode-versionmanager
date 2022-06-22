import * as vscode from 'vscode';
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