import os
import subprocess
import datetime
import argparse

DB_USER = os.getenv("DB_USER", "cargox_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "cargox_password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5055")
DB_NAME = os.getenv("DB_NAME", "cargox")
TEST_DB_NAME = os.getenv("TEST_DB_NAME", "cargox_dr_test")
BACKUP_DIR = os.getenv("BACKUP_DIR", "./backups")

os.environ["PGPASSWORD"] = DB_PASSWORD

def backup(filename=None):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if not filename:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{BACKUP_DIR}/cargox_backup_{timestamp}.sql"
        
    print(f"Starting backup of database '{DB_NAME}' to '{filename}'...")
    cmd = [
        "pg_dump",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-F", "c",
        "-b",
        "-v",
        "-f", filename,
        DB_NAME
    ]
    try:
        subprocess.run(cmd, check=True)
        print("Backup completed successfully.")
        return filename
    except subprocess.CalledProcessError as e:
        print(f"Backup failed: {e}")
        return None

def verify(backup_file):
    print(f"Starting Disaster Recovery verification using backup '{backup_file}'...")
    
    # 1. Drop and recreate test database
    try:
        print(f"Recreating test database '{TEST_DB_NAME}'...")
        subprocess.run(["dropdb", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "--if-exists", TEST_DB_NAME], check=True)
        subprocess.run(["createdb", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, TEST_DB_NAME], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Failed to recreate test database: {e}")
        return False
        
    # 2. Restore to test database
    print("Restoring backup to test database...")
    cmd = [
        "pg_restore",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", TEST_DB_NAME,
        "-v",
        backup_file
    ]
    try:
        subprocess.run(cmd, check=True)
        print("Restore completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Restore failed: {e}. Note: some errors may be ignored during restore.")
        
    # 3. Verify integrity
    print("Verifying database integrity...")
    cmd_count = [
        "psql",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", TEST_DB_NAME,
        "-c", "SELECT count(*) FROM users;"
    ]
    try:
        result = subprocess.run(cmd_count, check=True, capture_output=True, text=True)
        print("Integrity check passed. Users table is readable:")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Integrity check failed: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CargoX Disaster Recovery Script")
    parser.add_argument("action", choices=["backup", "verify", "full"], help="Action to perform")
    parser.add_argument("--file", help="Backup file to verify (required for 'verify' action)")
    
    args = parser.parse_args()
    
    if args.action == "backup":
        backup()
    elif args.action == "verify":
        if not args.file:
            print("Error: --file argument is required for verify action.")
        else:
            verify(args.file)
    elif args.action == "full":
        b_file = backup()
        if b_file:
            verify(b_file)
