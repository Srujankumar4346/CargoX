import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

try:
    conn = psycopg2.connect(
        dbname='postgres',
        user='postgres',
        password='Srujan@123',
        host='localhost',
        port='5055'
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'cargox'")
    exists = cursor.fetchone()
    if not exists:
        cursor.execute('CREATE DATABASE cargox')
        print("Database 'cargox' created successfully!")
    else:
        print("Database 'cargox' already exists.")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
