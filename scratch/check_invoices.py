import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['cargox']
    users = await db['users'].find().to_list(None)
    invs = await db['invoices'].find().to_list(None)
    print('Users:')
    for u in users:
        print(f"  {u.get('email')} (Role: {u.get('role')}) - Company: {u.get('customer_company_id')}")
    print('\nInvoices:')
    for i in invs:
        print(f"  {i.get('invoice_number')} - Request: {i.get('request_id')} - Company: {i.get('customer_company_id')}")

if __name__ == '__main__':
    asyncio.run(main())
