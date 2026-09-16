import glob
import os

deletes = [
    'db.execute(text("DELETE FROM trip_expenses"))',
    'db.execute(text("DELETE FROM vehicle_maintenance"))',
    'db.execute(text("DELETE FROM notifications"))',
    'db.execute(text("DELETE FROM payments"))',
    'db.execute(text("DELETE FROM invoices"))',
    'db.execute(text("DELETE FROM location_histories"))',
    'db.execute(text("DELETE FROM proof_of_deliveries"))',
    'db.execute(text("DELETE FROM vehicle_assignments"))',
    'db.execute(text("DELETE FROM trips"))',
    'db.execute(text("DELETE FROM quotations"))',
    'db.execute(text("DELETE FROM delivery_requests"))',
    'db.execute(text("DELETE FROM recipient_companies"))',
    'db.execute(text("DELETE FROM pricing_configs"))',
    'db.execute(text("DELETE FROM drivers"))',
    'db.execute(text("DELETE FROM vehicles"))',
    'db.execute(text("DELETE FROM users"))',
    'db.execute(text("DELETE FROM customer_companies"))'
]

for f in glob.glob('tests/*.py'):
    with open(f, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    new_lines = []
    in_cleanup = False
    added_deletes = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if 'DELETE FROM' in line and 'db.execute' in line:
            if not added_deletes:
                # Find indentation
                indent = len(line) - len(line.lstrip())
                indent_str = ' ' * indent
                for d in deletes:
                    new_lines.append(indent_str + d + '\n')
                added_deletes = True
            # Skip all consecutive DELETE FROM lines
            while i < len(lines) and 'DELETE FROM' in lines[i] and 'db.execute' in lines[i]:
                i += 1
            continue
            
        new_lines.append(line)
        i += 1

    with open(f, 'w', encoding='utf-8') as file:
        file.writelines(new_lines)
