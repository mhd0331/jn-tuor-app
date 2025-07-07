# app/models/review.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    hospital_id = Column(Integer, ForeignKey("hospitals.id"))
    rating = Column(Float, nullable=False)  # 1.0 ~ 5.0
    comment = Column(Text)
    is_verified = Column(Boolean, default=True)  # 실제 예약 완료 후 작성된 리뷰
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    reservation = relationship("Reservation", back_populates="review")
    user = relationship("User", back_populates="reviews")
    hospital = relationship("Hospital", back_populates="reviews")
    images = relationship("ReviewImage", back_populates="review", cascade="all, delete-orphan")

class ReviewImage(Base):
    __tablename__ = "review_images"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"))
    image_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    review = relationship("Review", back_populates="images")

# app/schemas/review.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime

class ReviewImageBase(BaseModel):
    image_url: str

class ReviewImageResponse(ReviewImageBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReviewBase(BaseModel):
    rating: float = Field(..., ge=1.0, le=5.0)
    comment: Optional[str] = Field(None, max_length=1000)

class ReviewCreate(ReviewBase):
    reservation_id: int
    images: Optional[List[str]] = []
    
    @validator('rating')
    def validate_rating(cls, v):
        # 0.5 단위로만 허용 (1.0, 1.5, 2.0, ..., 5.0)
        if v * 2 != int(v * 2):
            raise ValueError('평점은 0.5 단위로만 입력 가능합니다.')
        return v

class ReviewUpdate(BaseModel):
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    comment: Optional[str] = Field(None, max_length=1000)
    images: Optional[List[str]] = None

class ReviewResponse(ReviewBase):
    id: int
    reservation_id: int
    user_id: int
    hospital_id: int
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    images: List[ReviewImageResponse] = []
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class ReviewListResponse(BaseModel):
    reviews: List[ReviewResponse]
    total_count: int
    average_rating: float
    rating_distribution: dict  # {5: 10, 4: 5, 3: 2, 2: 1, 1: 0}

# app/api/v1/endpoints/review.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.review import Review, ReviewImage
from app.models.reservation import Reservation, ReservationStatus
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.review import (
    ReviewCreate, 
    ReviewUpdate, 
    ReviewResponse, 
    ReviewListResponse
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=ReviewResponse)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """리뷰 작성"""
    # 예약 확인
    reservation = db.query(Reservation).filter(
        Reservation.id == review_data.reservation_id,
        Reservation.user_id == current_user.id,
        Reservation.status == ReservationStatus.COMPLETED
    ).first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="완료된 예약을 찾을 수 없습니다."
        )
    
    # 예약 완료 후 30일 이내만 리뷰 작성 가능
    if datetime.utcnow() - reservation.reservation_date > timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="예약 완료 후 30일 이내에만 리뷰를 작성할 수 있습니다."
        )
    
    # 중복 리뷰 확인
    existing_review = db.query(Review).filter(
        Review.reservation_id == review_data.reservation_id
    ).first()
    
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 리뷰를 작성하셨습니다."
        )
    
    # 리뷰 생성
    review = Review(
        reservation_id=review_data.reservation_id,
        user_id=current_user.id,
        hospital_id=reservation.hospital_id,
        rating=review_data.rating,
        comment=review_data.comment,
        is_verified=True
    )
    db.add(review)
    db.flush()
    
    # 이미지 추가
    for image_url in review_data.images:
        review_image = ReviewImage(
            review_id=review.id,
            image_url=image_url
        )
        db.add(review_image)
    
    # 병원 평균 평점 업데이트
    update_hospital_rating(db, reservation.hospital_id)
    
    db.commit()
    db.refresh(review)
    
    # 사용자 이름 추가
    review.user_name = current_user.name
    
    return review

@router.get("/hospital/{hospital_id}", response_model=ReviewListResponse)
async def get_hospital_reviews(
    hospital_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("recent", regex="^(recent|rating_high|rating_low)$"),
    rating_filter: Optional[float] = Query(None, ge=1.0, le=5.0),
    db: Session = Depends(get_db)
):
    """병원별 리뷰 목록 조회"""
    # 병원 확인
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="병원을 찾을 수 없습니다."
        )
    
    # 쿼리 빌드
    query = db.query(Review).filter(Review.hospital_id == hospital_id)
    
    # 평점 필터
    if rating_filter:
        query = query.filter(Review.rating == rating_filter)
    
    # 정렬
    if sort_by == "recent":
        query = query.order_by(Review.created_at.desc())
    elif sort_by == "rating_high":
        query = query.order_by(Review.rating.desc(), Review.created_at.desc())
    elif sort_by == "rating_low":
        query = query.order_by(Review.rating.asc(), Review.created_at.desc())
    
    # 전체 개수
    total_count = query.count()
    
    # 페이지네이션
    reviews = query.options(
        joinedload(Review.user),
        joinedload(Review.images)
    ).offset((page - 1) * limit).limit(limit).all()
    
    # 평균 평점 계산
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.hospital_id == hospital_id
    ).scalar() or 0
    
    # 평점 분포 계산
    rating_dist = db.query(
        Review.rating,
        func.count(Review.id)
    ).filter(
        Review.hospital_id == hospital_id
    ).group_by(Review.rating).all()
    
    rating_distribution = {float(i): 0 for i in range(1, 6)}
    for rating, count in rating_dist:
        rating_distribution[float(rating)] = count
    
    # 응답 데이터 구성
    review_responses = []
    for review in reviews:
        review_dict = {
            "id": review.id,
            "reservation_id": review.reservation_id,
            "user_id": review.user_id,
            "hospital_id": review.hospital_id,
            "rating": review.rating,
            "comment": review.comment,
            "is_verified": review.is_verified,
            "created_at": review.created_at,
            "updated_at": review.updated_at,
            "images": review.images,
            "user_name": review.user.name if review.user else None
        }
        review_responses.append(ReviewResponse(**review_dict))
    
    return ReviewListResponse(
        reviews=review_responses,
        total_count=total_count,
        average_rating=round(avg_rating, 1),
        rating_distribution=rating_distribution
    )

@router.get("/my-reviews", response_model=List[ReviewResponse])
async def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내가 작성한 리뷰 목록 조회"""
    reviews = db.query(Review).filter(
        Review.user_id == current_user.id
    ).options(
        joinedload(Review.images),
        joinedload(Review.hospital)
    ).order_by(Review.created_at.desc()).all()
    
    return reviews

@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: int,
    review_update: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """리뷰 수정"""
    review = db.query(Review).filter(
        Review.id == review_id,
        Review.user_id == current_user.id
    ).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="리뷰를 찾을 수 없습니다."
        )
    
    # 작성 후 7일 이내만 수정 가능
    if datetime.utcnow() - review.created_at > timedelta(days=7):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="리뷰 작성 후 7일 이내에만 수정할 수 있습니다."
        )
    
    # 리뷰 업데이트
    if review_update.rating is not None:
        review.rating = review_update.rating
    if review_update.comment is not None:
        review.comment = review_update.comment
    
    # 이미지 업데이트
    if review_update.images is not None:
        # 기존 이미지 삭제
        db.query(ReviewImage).filter(ReviewImage.review_id == review_id).delete()
        
        # 새 이미지 추가
        for image_url in review_update.images:
            review_image = ReviewImage(
                review_id=review_id,
                image_url=image_url
            )
            db.add(review_image)
    
    review.updated_at = datetime.utcnow()
    
    # 병원 평균 평점 업데이트
    update_hospital_rating(db, review.hospital_id)
    
    db.commit()
    db.refresh(review)
    
    return review

@router.delete("/{review_id}")
async def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """리뷰 삭제"""
    review = db.query(Review).filter(
        Review.id == review_id,
        Review.user_id == current_user.id
    ).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="리뷰를 찾을 수 없습니다."
        )
    
    hospital_id = review.hospital_id
    db.delete(review)
    
    # 병원 평균 평점 업데이트
    update_hospital_rating(db, hospital_id)
    
    db.commit()
    
    return {"message": "리뷰가 삭제되었습니다."}

@router.get("/check-reviewable/{reservation_id}")
async def check_reviewable(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """리뷰 작성 가능 여부 확인"""
    # 예약 확인
    reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id,
        Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        return {"reviewable": False, "reason": "예약을 찾을 수 없습니다."}
    
    if reservation.status != ReservationStatus.COMPLETED:
        return {"reviewable": False, "reason": "완료된 예약만 리뷰를 작성할 수 있습니다."}
    
    # 기존 리뷰 확인
    existing_review = db.query(Review).filter(
        Review.reservation_id == reservation_id
    ).first()
    
    if existing_review:
        return {"reviewable": False, "reason": "이미 리뷰를 작성하셨습니다."}
    
    # 30일 경과 확인
    if datetime.utcnow() - reservation.reservation_date > timedelta(days=30):
        return {"reviewable": False, "reason": "예약 완료 후 30일이 지났습니다."}
    
    return {"reviewable": True, "reservation": reservation}

def update_hospital_rating(db: Session, hospital_id: int):
    """병원 평균 평점 업데이트"""
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.hospital_id == hospital_id
    ).scalar()
    
    review_count = db.query(func.count(Review.id)).filter(
        Review.hospital_id == hospital_id
    ).scalar()
    
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if hospital:
        hospital.average_rating = round(avg_rating, 1) if avg_rating else 0
        hospital.review_count = review_count or 0

# main.py에 라우터 추가
from app.api.v1.endpoints import review

app.include_router(review.router, prefix="/api/v1/reviews", tags=["reviews"])

# Hospital 모델에 추가 (models/hospital.py)
# average_rating = Column(Float, default=0)
# review_count = Column(Integer, default=0)
# reviews = relationship("Review", back_populates="hospital")

# User 모델에 추가 (models/user.py)
# reviews = relationship("Review", back_populates="user")

# Reservation 모델에 추가 (models/reservation.py)
# review = relationship("Review", back_populates="reservation", uselist=False)