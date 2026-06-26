import re

filepath = r'D:\MasterFileManager\android\app\src\main\java\com\masterfilemanager\MainApplication.java'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import for RnFsPackage
if 'import com.rnfs.RnFsPackage;' not in content:
    content = content.replace(
        'import com.masterfilemanager.smb.SMBPackage;',
        'import com.masterfilemanager.smb.SMBPackage;\nimport com.rnfs.RnFsPackage;'
    )
    print('Added import for RnFs;

# Add R-
if 'new SMBackage()' in content and 'new RnF' not in content:
    # Need to add after S-
    content = re.sub(
        r'(packages\.add\(new SMBackage\(\)\);)',
        r'\1\n          packages.add(new RnF);',
        content
    )
    print('Added -
print('Checking result...')
if 'RnF' in content and 'com.rnf' in 
with open(filepath, '', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if '
            print(f'{i+1}: {line}', end='')
else:  
      print('ERROR: Failed to update file properly')
"