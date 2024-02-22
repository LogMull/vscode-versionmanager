# osc-versionmanager README

Plugin to allow for easy integration with Version Manager.
Also includes a variety of quality of line enhancements to make using VSCode easier with Objectscript.

## Features

Add to Task
    Adds the currently open file to the task of choice

Add Open Files to Task
    Select any of the currently open files to add to a single task

Remove from Task
    Remove the current file from a task

Check for Updates
    Check the server for an updated version of the plugin


## Extension Settings

This extension contributes the following settings:

* `versionmanager.request.user`: Artiva User in the VM instance
* `versionmanager.request.includeNew`: Include tasks in the NEW status
* `versionmanager.request.includeHold`: Include tasks in the HLD status
* `versionmanager.server.serverName` : Name of the server definition defined in the Intersystems Server Manager. Used to build the server's url and supply cache credentials
* `versionmanager.checkForUpdates` : Allows the plugin to self update automatically after VS Code starts. Temporarily disabled, will be reworked in the future.
* `versionmanager.verifyDevNamespace` : Option to control what tasks are shown.  If true, the current namespace must match the task's development namespace.  Disabling this can be useful to local sandbox development.