from typing import Annotated, Optional
from decimal import Decimal
from pydantic import BaseModel, BeforeValidator
from bson import Decimal128
def convert_decimal128(v):
    if isinstance(v, Decimal128): return str(v)
    return v
DecimalType = Annotated[Decimal, BeforeValidator(convert_decimal128)]
class M(BaseModel):
    cost: Optional[DecimalType] = None
print(M(cost=Decimal128('1500.00')))
