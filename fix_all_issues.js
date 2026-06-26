const fs = require('fs');
const filePath = 'D:/MasterFileManager/src/screens/FileBrowserScreen.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// ============================================================
// Fix Issues:
//   1. Remove stray "?" button — caused by leftover Fragment rendering glitch.
//      Rewrite entire Header block cleanly.
//   2. Menu adjustments per user request.
//   3. SMB path now shows correctly in header title/subtitle.
//
// Changes made below via string replacement of exact existing blocks.
//
// NOTE: All JSX must be syntactically perfect; run TypeScript check after!
// ============================================================

/* ---------- Step A：重写整个 AppBar.Header（行~454~528） ---------- */

/** —— OLD HEADER BLOCK START —— **/
const OLD_HEADER_START = '<Appbar.Header>';
const OLD_HEADER_END = '</Appbar.Header>';

const NEW_HEADER_BLOCK =
`<AppBarWrapperInternal currentPath={currentPath} isSelectionMode={isSelectionMode} selectedItemsSize={selectedItems.size} filesLength={files.length} handleSelectAllAndEnter={() => handleSelectAllAndEnter()} handleDeselectAll={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} clipboardPresent={(clipboard || FileService.globalClipboard)} setTitleOrUndefined={(v) => v /* placeholder */} />`;

console.log('🛑 This approach too complex—switching to simple regex replace.');

process.exit(0);
