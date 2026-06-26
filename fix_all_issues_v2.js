const fs = require('fs');

const filePath = 'D:/MasterFileManager/src/screens/FileBrowserScreen.tsx';
let c = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });

console.log('🔧 Fixing Issue #1: Stray "?" button...');
// In non-selection-mode branch, the ternary evaluates to false|'select-all'
// causing icon={false} which shows "?" fallback.
// Fix: simplify non-selection-mode select-all btn JSX

const OLD_NON_SEL_BTN = `<Appbar.Action\n              icon={selectedItems.size === files.length && isSelectionMode ? 'select-none' : 'select-all'}\n              onPress={() => {\n                if (isSelectionMode && selectedItems.size === files.length) {\n                  // Already all selected → deselect all and exit selection mode\n                  setSelectedItems(new Set());\n                  setIsSelectionMode(false);\n                } else {\n                  handleSelectAllAndEnter();\n                }\n              }}\n            />`;

const NEW_NON_SEL_BTN = `<Appbar.Action\n              icon={'select-all'}\n              onPress={() => {\n                handleSelectAllAndEnter();\n              }}\n            />`;

if (c.includes(OLD_NON_SEL_BTN)) {
  c = c.replace(OLD_NON_SEL_BTN, NEW_NON_SEL_BTN);
  console.log('✅ Fixed Issue #1');
} else {
  console.log('⚠️ Could not find Issue #1 target—skipping.');
}

console.log('\n🔧 Fixing Issue #2a: Menu「全选/取消」→「全选」...');
const OLD_MENU_SELECT_ALL = `title="全选/取消"`;
if (c.includes(OLD_MENU_SELECT_ALL)) {
  c = c.replace(OLD_MENU_SELECT_ALL, `title="全选"`);
  console.log('✅ Fixed menu item text');
} else {
  console.log('⚠️ Could not find「全选/取消」—skipping.'); 
}

console.log('\n🔧 Fixing Issue #2b: Remove 「取消」menu item...');

// Find & remove entire Menu.Item with title="取消"
const MENU_CANCEL_RE =
  /<Menu\.Item\s+onPress=\{\s*\(\)\s*=>\s*\{[^}]*setClipboard\(null\)[^}]*showToast\([^)]*已取消全部操作[^)]*\)[^}]*\}\s*\}\s+title="取消"\s*\/>/;

let match;
while ((match = MENU_CANCEL_RE.exec(c)) !== null) {
   const fullMatchStartIndex=m.atIndex; // FIXME ternary exp mistake...
}
process.exit(0);
