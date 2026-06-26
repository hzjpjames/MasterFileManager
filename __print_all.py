import codecs

path = r'D:\MasterFileManager\crash_log_new.txt'
with codecs.open(path, 'r', encoding='utf-16-le') as f:
    lines = f.readlines()

print(f'Total lines: {len(lines)}')
print('')
# 打印全部内容
for i, line in enumerate(lines):
    print(f'{i:3d}: {line.rstrip()}')