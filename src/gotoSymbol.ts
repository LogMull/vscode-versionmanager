import * as vscode from 'vscode';
import { verifyFileURI } from './util';
/// Set up a mapping of symbol 'kinds' to the appropriate image to use in the label
/// Markdown syntax for this is $(symbol-method)
const symbolKindIconMap={
    5: 'symbol-method', //method
    6: 'symbol-property',// property
    13:'symbol-constant' // parameter
}

// Handle a request to go to a symbole
export async function handleGotoSymbol(){
    // Always assume the current document
    const activeEditor = vscode.window.activeTextEditor;
    const currentFile =activeEditor.document;
    if (!currentFile) return // should not allow symbol lookup if there's nothing selected
    const valInfo = verifyFileURI(currentFile.uri);
    // If the current file is valid to add to a VM task, the symbol lookup should work fine here.  If not, skip it.
    if (!valInfo.validForSymbol){
        return;
    }
    // Get a list of all of the symbols for the current document
    const symbols = await getSymbols(currentFile);
    const list = [];
    let array = symbols;
    if (symbols[0].kind==4){ // kind==4 means class, so the entries will be nested inside it's children
        array = symbols[0].children
    }
    // Add each symbol to the quick pick
    for (let symbol of array){
        const symbolObj = {
            "label": `$(${symbolKindIconMap[symbol.kind]}) ${symbol.name}`,
			"description":'',
			"symbolDetail": symbol
        };
        // If the type of symbol is explicity listed, show it here
        if (symbol.detail){
            symbolObj.description = `(${symbol.detail}) ${symbol.name}`;
        }
        list.push(symbolObj);
    }
    // Keep track of the original poisitions, in case we want to jump back if this command is cancelled.
    const oRange = activeEditor.visibleRanges;
    const oSel = activeEditor.selection;
    // As the symbol name is being set, jump to the currently selected one.
    const symbolSelect = (item:vscode.QuickPickItem)=>{
       goToSymbolInternal(activeEditor.document, item, 0);
    }
    const symbol = await vscode.window.showQuickPick(list, { placeHolder: 'Select a symbol.', title: `Available Symbols.`, matchOnDescription: true, 'onDidSelectItem': symbolSelect })
    // If a symbol was not selected, do nothing further
    if (!symbol) return;
    const offsetValidation = (value:string)=>{
        if (value.match(/^[\+|-]?\d+$/)) return ''; // +123, -123, 123        
        if (value == '$') return '';
        if (value.match(/^\$[\+|-]\d+$/)) return ''; // $+123, $-123

        return 'Offset must be in the form of [$]+/-123';
        // assume valid
        return '';
    };
    // Get the current offset.
    let offset = await vscode.window.showInputBox({'prompt':'Enter line offset','placeHolder':'eg 5, -10, $ for last line, blank for start','validateInput':offsetValidation})
    let referenceFromEnd=false;
    // If the end of the symbol is requested, offset is 0, but the ending point is used instead.
    if (offset=='$'){
        offset='0';
        referenceFromEnd=true;
    }else if (offset.includes('$')){ //Otherwise, if $ is included, set the offset appropraitely.
        referenceFromEnd=true;
        offset=offset.split('$')[1];
    }   
    
    goToSymbolInternal(activeEditor.document, symbol, offset, referenceFromEnd);
}

// Use the language server to get the symboles in the document
async function getSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri) || [];
}

// Given the document, desired symbol and line offset number, go to a symbol.
function goToSymbolInternal(document: vscode.TextDocument,symbol,offset,referenceFromEnd?:boolean){
    const rangeOffset = parseInt(offset);

    const range = symbol.symbolDetail.selectionRange;
    let start=0;
    if (referenceFromEnd){
        start = symbol.symbolDetail.range.end.line;
    }else{
        start = range.start.line;
    }
    start = Math.max(start+rangeOffset,0);

    const startPos = new vscode.Position(start, 0);
    
    const endPos = new vscode.Position(startPos.line, startPos.character); // Only really care about the starting point, never going to be pre-selecting an actual range.

    const newRange = new vscode.Range(startPos, endPos)

    // Now that the offset is known, try to go to it.
    vscode.window.activeTextEditor.revealRange(newRange, vscode.TextEditorRevealType.InCenter);
    vscode.window.activeTextEditor.selection = new vscode.Selection(newRange.start, newRange.start);
}