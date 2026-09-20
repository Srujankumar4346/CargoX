import asyncio
from app.db.database import init_db
from app.models.finance import Invoice
async def main():
    await init_db()
    print([m for m in dir(Invoice) if 'collection' in m.lower()])
asyncio.run(main())
