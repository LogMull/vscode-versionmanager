import * as vscode from 'vscode';
import { getFileSymbols } from './gotoSymbol';


var convert = require('xml-js');

import * as writeXML from './xmlFormatter';


export async function formatObjectScriptClass(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
 
    // Get a list of all of the symbols for the current document
    const symbols = await getFileSymbols();
    // Find all of the XData nodes to start with very likely XML
    const xDataSymbols = symbols.filter((el) => el.detail=='XData');

    let allEdits = [];
    formatAllXData(xDataSymbols,allEdits)

    return Promise.resolve(
        allEdits
    );

}
// Formatting XData is primarily done with formatting XML.
// Will other types be needed later? Maybe CSS formatting?
// Formatting the XML is done largely either with the xml-js library or with our own modified version of it.
// The XML is parsed into a JSON object using xml-js and then our own rework of JSON -> XML will handle the conversion back.
// Options from ./formatConfig/xmlConfig.json will be used to handle how the XML is parsed.  See the readme in ./formatConfig for more info
function formatAllXData(symbols: vscode.DocumentSymbol[], allEdits: vscode.TextEdit[]){
    for (let symbol of symbols) {
        // Grab the entire node
        let wholeNode = vscode.window.activeTextEditor.document.getText(symbol.range)
        const xmlStart = wholeNode.indexOf('{');
        const xmlEnd = wholeNode.lastIndexOf('}');
        // Get the XML node
        let xmlStr = wholeNode.substring(xmlStart + 1, xmlEnd)
        // TODO - Ensure this chunk is valid somehow, maybe making sure it doesn't overlap? If the XML isn't valid, the symbol stuff does not recognize it very well at all
        // Conver the XML string to a JSON object
        let xmlJSON = convert.xml2js(xmlStr, {
            alwaysArray: true,
        }); 
        // Conver the object back with our own rules
        let formattedXML = writeXML(xmlJSON, {
            // spaces: 2,
            spaces: '\t',
            indentAttributes: true
            
        });
        // Push the edited changes back into the document
        let result = wholeNode.substring(0, xmlStart+1) +'\n'+ formattedXML + '\n'+ wholeNode.substring(xmlEnd)+'\n';
        allEdits.push(new vscode.TextEdit(symbol.range,result));

    }
}
/*
    Potential XML formatting rules /sets / configurations
    Specific tag overrides
        always singles line, single line when X props
    
    List of all tags that should be single lines

    Regex for a tag, for example so all osc:gridXXColumn, gridParameter, etc can behave the same

    should always strip the NS off of the control so it can be handled regardless of how it is named, no need for a difference between osc:findList or artiva:findList, makes it easier to extend too

    Global rules such as min props to wrap

*/

