import glob
import re

for f in glob.glob('tests/*.py'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    if 'DELETE FROM notifications' in content:
        continue

    # Regex to find either DELETE FROM payments or DELETE FROM location_histories, whichever comes first
    pattern = re.compile(r'([ \t]+)(db\.execute\(text\("DELETE FROM (?:payments|location_histories)"\)\))')
    
    def replacer(match):
        indent = match.group(1)
        original_line = match.group(2)
        return f'{indent}db.execute(text("DELETE FROM notifications"))\n{indent}{original_line}'
        
    new_content = pattern.sub(replacer, content, count=1)
    
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
