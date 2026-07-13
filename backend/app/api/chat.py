import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import (
    get_current_user,
    get_workspace_membership,
)
from app.db.dependencies import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationDetailResponse,
    ConversationResponse,
)
from app.services.conversation_service import (
    create_conversation,
    get_user_conversation,
)
from app.services.rag_service import answer_question


router = APIRouter(
    prefix="/workspaces/{workspace_id}",
    tags=["Chat"],
)


@router.post(
    "/chat",
    response_model=ChatResponse,
)
def chat_with_workspace(
    workspace_id: uuid.UUID,
    chat_data: ChatRequest,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatResponse:
    del membership

    conversation: Conversation | None = None

    if chat_data.conversation_id is not None:
        conversation = get_user_conversation(
            database=database,
            workspace_id=workspace_id,
            conversation_id=chat_data.conversation_id,
            user_id=current_user.id,
        )

        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

    if conversation is None:
        conversation = create_conversation(
            database=database,
            workspace_id=workspace_id,
            user=current_user,
            question=chat_data.question,
        )

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=chat_data.question.strip(),
        citations=[],
        metadata_json={},
    )

    database.add(user_message)
    database.flush()

    answer, citations, evidence_found = answer_question(
        database=database,
        workspace_id=workspace_id,
        question=chat_data.question,
        limit=chat_data.limit,
        minimum_similarity=chat_data.minimum_similarity,
    )

    citation_payload = [
        citation.model_dump(mode="json")
        for citation in citations
    ]

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        citations=citation_payload,
        metadata_json={
            "evidence_found": evidence_found,
            "retrieval_limit": chat_data.limit,
            "minimum_similarity": chat_data.minimum_similarity,
        },
    )

    database.add(assistant_message)
    database.commit()
    database.refresh(assistant_message)

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        question=chat_data.question,
        answer=answer,
        citations=citations,
        evidence_found=evidence_found,
    )


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
)
def list_conversations(
    workspace_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[Conversation]:
    del membership

    return list(
        database.scalars(
            select(Conversation)
            .where(
                Conversation.workspace_id == workspace_id,
                Conversation.user_id == current_user.id,
            )
            .order_by(Conversation.updated_at.desc())
        )
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
def get_conversation(
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Conversation:
    del membership

    conversation = database.scalar(
        select(Conversation)
        .options(
            selectinload(Conversation.messages)
        )
        .where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
            Conversation.user_id == current_user.id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return conversation


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_conversation(
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    membership: WorkspaceMember = Depends(
        get_workspace_membership
    ),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    del membership

    conversation = get_user_conversation(
        database=database,
        workspace_id=workspace_id,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    database.delete(conversation)
    database.commit()
