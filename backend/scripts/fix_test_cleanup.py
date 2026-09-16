import glob
for f in glob.glob('tests/*.py'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    if 'DELETE FROM notifications"))\n        db.execute(text("DELETE FROM payments' in content:
        content = content.replace('DELETE FROM notifications"))\n        db.execute(text("DELETE FROM payments', 'DELETE FROM payments')

    if 'DELETE FROM notifications"))\n            db.execute(text("DELETE FROM location_histories' in content:
        content = content.replace('DELETE FROM notifications"))\n            db.execute(text("DELETE FROM location_histories', 'DELETE FROM location_histories')

    if 'DELETE FROM payments' in content:
        content = content.replace('DELETE FROM payments', 'DELETE FROM notifications"))\n        db.execute(text("DELETE FROM payments')
    elif 'DELETE FROM location_histories' in content:
        content = content.replace('DELETE FROM location_histories', 'DELETE FROM notifications"))\n            db.execute(text("DELETE FROM location_histories')
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
