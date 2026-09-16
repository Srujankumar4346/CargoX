import glob
import re

complete_cleanup = """db.execute(text("DELETE FROM notifications"))
            db.execute(text("DELETE FROM payments"))
            db.execute(text("DELETE FROM invoices"))
            db.execute(text("DELETE FROM location_histories"))
            db.execute(text("DELETE FROM proof_of_deliveries"))
            db.execute(text("DELETE FROM vehicle_assignments"))
            db.execute(text("DELETE FROM trips"))
            db.execute(text("DELETE FROM quotations"))
            db.execute(text("DELETE FROM delivery_requests"))
            db.execute(text("DELETE FROM recipient_companies"))
            db.execute(text("DELETE FROM pricing_configs"))
            db.execute(text("DELETE FROM drivers"))
            db.execute(text("DELETE FROM vehicles"))
            db.execute(text("DELETE FROM users"))
            db.execute(text("DELETE FROM customer_companies"))"""

for f in glob.glob('tests/*.py'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We find the sequence of DELETE statements and replace them with the complete list.
    # A regex to match from the first DELETE FROM to the last DELETE FROM.
    pattern = re.compile(r'(db\.execute\(text\("DELETE FROM [a-z_]+"\)\)\s*)+')
    
    def replacer(match):
        # We need to extract the indentation of the first matched line to apply to our replacement
        lines = match.group(0).split('\n')
        indent = len(lines[0]) - len(lines[0].lstrip())
        indent_str = ' ' * indent
        
        indented_cleanup = '\n'.join([indent_str + line.strip() for line in complete_cleanup.split('\n')])
        return indented_cleanup + '\n'
        
    new_content = pattern.sub(replacer, content)
    
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
