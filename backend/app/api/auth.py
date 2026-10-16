from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import verify_password, get_password_hash, create_access_token
from backend.app.models.db_models import User, UserProfile, Consent
from backend.app.models.schemas import (
    UserCreate,
    UserLogin,
    Token,
    UserOut,
    UserProfileOut,
    UserProfileUpdate,
    UserProfileCreate,
    ConsentCreate,
    ConsentOut,
)
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role or "patient",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create associated default profile
    profile = UserProfile(
        user_id=user.id,
        baseline_resting_hr=72.0,
        baseline_sleep_hours=7.5,
        baseline_caffeine_cups=1.0,
        baseline_hrv_ms=45.0,
        onboarding_completed=False,
    )
    db.add(profile)

    # Initial default consent
    default_consent = Consent(
        user_id=user.id,
        consent_type="health_data_processing",
        consented=True,
    )
    db.add(default_consent)
    db.commit()

    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role or "patient",
        onboarding_completed=False,
    )


@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    onboarded = False
    if user.profile:
        onboarded = bool(user.profile.onboarding_completed)

    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role or "patient",
        onboarding_completed=onboarded,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/profile", response_model=UserProfileOut)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/profile", response_model=UserProfileOut)
def update_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/onboarding", response_model=UserProfileOut)
def complete_onboarding(
    onboarding_in: UserProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    profile.age = onboarding_in.age
    profile.biological_sex = onboarding_in.biological_sex
    profile.baseline_resting_hr = onboarding_in.baseline_resting_hr or 72.0
    profile.baseline_sleep_hours = onboarding_in.baseline_sleep_hours or 7.5
    profile.baseline_caffeine_cups = onboarding_in.baseline_caffeine_cups or 1.0
    profile.baseline_hrv_ms = onboarding_in.baseline_hrv_ms or 45.0
    profile.medical_history_notes = onboarding_in.medical_history_notes
    profile.has_panic_history = onboarding_in.has_panic_history or False
    profile.trait_anxiety_score = onboarding_in.trait_anxiety_score
    profile.onboarding_completed = True
    profile.updated_at = datetime.now(timezone.utc)

    # Save consents
    if onboarding_in.consents:
        for c_type in onboarding_in.consents:
            existing = db.query(Consent).filter(
                Consent.user_id == current_user.id,
                Consent.consent_type == c_type
            ).first()
            if not existing:
                db.add(Consent(user_id=current_user.id, consent_type=c_type, consented=True))

    db.commit()
    db.refresh(profile)

    # Trigger initial Digital Twin state snapshot
    try:
        from backend.app.api.observations import trigger_state_update
        trigger_state_update(current_user, db, source="personal_mode")
    except Exception:
        pass

    return profile


@router.get("/consents", response_model=List[ConsentOut])
def get_consents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Consent).filter(Consent.user_id == current_user.id).all()


@router.post("/consents", response_model=ConsentOut)
def record_consent(
    consent_in: ConsentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consent = db.query(Consent).filter(
        Consent.user_id == current_user.id,
        Consent.consent_type == consent_in.consent_type
    ).first()

    if not consent:
        consent = Consent(
            user_id=current_user.id,
            consent_type=consent_in.consent_type,
            consented=consent_in.consented,
        )
        db.add(consent)
    else:
        consent.consented = consent_in.consented
        if not consent_in.consented:
            consent.withdrawal_date = datetime.now(timezone.utc)
        else:
            consent.withdrawal_date = None

    db.commit()
    db.refresh(consent)
    return consent


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Right to erasure: permanently removes user profile, observations, checkins,
    and twin states.
    """
    db.delete(current_user)
    db.commit()
    return None
