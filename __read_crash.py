import codecs

path = r'D:\MasterFileManager\crash_log_new.txt'
with codecs.open(path, 'r', encoding='utf-16-le') as f:
    lines = f.readlines()

print(f'Total lines: {len(lines)}')

# 找崩溃关键行
crash_keywords = ['FATAL EXCEPTION', 'AndroidRuntime', 'Exception', 'Signal', 'SIGSEGV', 'SIGABRT']
found = []
for i, line in enumerate(lines):
    if any(kw in line for kw in crash_keywords):
        found.append((i, line.rstrip()))

print(f'Found {len(found)} crash-related lines')
print('')
for i, line in found[:30]:
    print(f'{i}: {line}')