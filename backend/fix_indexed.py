import os
import re

model_dir = r'c:\Users\sange\Desktop\transport services\backend\app\models'
for file in os.listdir(model_dir):
    if not file.endswith('.py') or file == '__init__.py':
        continue
    filepath = os.path.join(model_dir, file)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'Indexed(' not in content:
        continue

    # Find all Indexed fields
    indexed_pattern = re.compile(r'^\s*([a-zA-Z0-9_]+):\s*(?:Optional\[)?Indexed\(([^,)]+)(?:,\s*unique=(True|False))?\)?(?:\])?\s*(?:=\s*(.+))?$', re.MULTILINE)
    
    matches = indexed_pattern.findall(content)
    if not matches:
        pass
        
    indexes = []
    
    for match in matches:
        field_name, field_type, is_unique, default_val = match
        unique_str = ', unique=True' if is_unique == 'True' else ''
        indexes.append(f'pymongo.IndexModel("{field_name}"{unique_str})')

    # Actually regex string replace is easier:
    content = re.sub(r'Indexed\(([^,)]+)(?:,\s*unique=(?:True|False))?\)', r'\1', content)
    
    # Add import pymongo
    if 'import pymongo' not in content:
        content = 'import pymongo\n' + content
        
    # Remove from beanie import Indexed if it exists
    content = content.replace(', Indexed', '').replace('Indexed, ', '')
    
    # Inject indexes into Settings
    if indexes:
        index_str = '        indexes = [\n            ' + ',\n            '.join(indexes) + '\n        ]\n'
        # find class Settings: \n name = '...'
        settings_pattern = re.compile(r'(class Settings:\s*\n\s*name\s*=\s*\"[^\"]+\"\s*\n)')
        content = settings_pattern.sub(r'\g<1>' + index_str, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed {file}')
