from sqlalchemy import create_engine, text
from app.core.config import settings
from app.db.base import Base
import app.models # this imports __init__.py which has all models

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    conn.execute(text('DROP SCHEMA public CASCADE;'))
    conn.execute(text('CREATE SCHEMA public;'))
    conn.execute(text('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;'))
    conn.commit()

Base.metadata.create_all(bind=engine)
