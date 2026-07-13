import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.user import User


def create_conversation(
    database: Session,
    workspace_id: uuid.UUID,
    user: User,
    question: str,
) -> Conversation:
    title = question.strip()

    if len(title) > 80:
        title = title[:77] + "..."

    conversation = Conversation(
        workspace_id=workspace_id,
        user_id=user.id,
        title=title or "New conversation",
    )

    database.add(conversation)
    database.flush()

    return conversation


def get_user_conversation(
    database: Session,
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Conversation | None:
    return database.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
            Conversation.user_id == user_id,
        )
    )
