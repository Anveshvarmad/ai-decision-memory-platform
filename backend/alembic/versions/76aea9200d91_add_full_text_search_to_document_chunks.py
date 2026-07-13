"""add full text search to document chunks

Revision ID: hybrid_search_001
Revises: REPLACE_WITH_PREVIOUS_REVISION
Create Date: 2026-07-13
"""

from typing import Sequence, Union

from alembic import op


revision: str = "hybrid_search_001"
down_revision: Union[str, None] = "815dd10ddc9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE document_chunks
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(
                to_tsvector(
                    'english',
                    coalesce(section_title, '')
                ),
                'A'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce(content, '')
                ),
                'B'
            )
        ) STORED
        """
    )

    op.execute(
        """
        CREATE INDEX ix_document_chunks_search_vector
        ON document_chunks
        USING GIN (search_vector)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS ix_document_chunks_search_vector
        """
    )

    op.execute(
        """
        ALTER TABLE document_chunks
        DROP COLUMN IF EXISTS search_vector
        """
    )
