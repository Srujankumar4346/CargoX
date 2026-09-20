import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['cargox']
    print('Reqs:', await db['delivery_requests'].count_documents({}))
    print('Trips:', await db['trips'].count_documents({}))
    print('Invs:', await db['invoices'].count_documents({}))

if __name__ == '__main__':
    asyncio.run(main())
