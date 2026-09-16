"""phase_8_invoice_sequence

Revision ID: a9f3c2d1e4b7
Revises: 1a76e80e5c60
Create Date: 2026-09-16 19:33:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9f3c2d1e4b7'
down_revision: Union[str, Sequence[str], None] = '1a76e80e5c60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create invoice_number_seq sequence for concurrency-safe invoice numbering."""
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1")
    # Index for fast customer invoice lookups
    op.create_index(
        'ix_invoices_customer_company_id',
        'invoices',
        ['customer_company_id']
    )
    op.create_index(
        'ix_invoices_status',
        'invoices',
        ['status']
    )


def downgrade() -> None:
    """Drop invoice_number_seq sequence."""
    op.drop_index('ix_invoices_status', table_name='invoices')
    op.drop_index('ix_invoices_customer_company_id', table_name='invoices')
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
