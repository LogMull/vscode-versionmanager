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

goto
    Allows jumping to a symbol, method or label and then moving to a line number offset relative to that point.

Check for Updates
    Check the server for an updated version of the plugin

Objectscript Class Formatting
    Support for formatting XML XData using a custom ruleset.
    Planned support for class comments, and inline javascript in the future.

## Extension Settings

This extension contributes the following settings:

* `versionmanager.request.user`: Artiva User in the VM instance
* `versionmanager.request.includeNew`: Include tasks in the NEW status
* `versionmanager.request.includeHold`: Include tasks in the HLD status
* `versionmanager.server.serverName` : Name of the server definition defined in the Intersystems Server Manager. Used to build the server's url and supply cache credentials
* `versionmanager.checkForUpdates` : Allows the plugin to self update automatically after VS Code starts

## Known Issues

Will not correctly limit tasks by the component when multiple components reside in a single namespace.  eg HCEE and HCTEMP elements are both in HCDEF
Updates in VM may provide a lift in preventing elements from being added to multiple components, but caution should still be used.

## External References
XML Formatting https://www.npmjs.com/package/xml-js, both used as distributed and modified for our specific use case, permitted under the MIT Liscense.
Intersystems Language Server, used for symbol recognition within classes and macros
Intersystems Server Manager, used for authentication to the Version Manager namespace