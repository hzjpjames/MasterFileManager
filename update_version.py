import re
path = r'D:\MasterFileManager\android\app\build.gradle'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'versionCode 33', 'versionCode 34', c)
c = re.sub(r'versionName "2\.1\.13"', 'versionName "2.1.14"', c)
with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

path2 = r'D:\MasterFileManager\src\screens\SettingsScreen.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('2.1.13', '2.1.14')
with open(path2, 'w', encoding='utf-8') as f:
    f.write(c)
print('done')
