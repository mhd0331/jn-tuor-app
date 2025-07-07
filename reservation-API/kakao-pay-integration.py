# app/models/payment.py
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum

class PaymentStatus(enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"))
    tid = Column(String(100), unique=True)  # 카카오페이 거래 ID
    amount = Column(Float)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    reservation = relationship("Reservation", back_populates="payment")

# Reservation 모델에 payment 관계 추가 (models/reservation.py에 추가)
# payment = relationship("Payment", back_populates="reservation", uselist=False)

# app/schemas/payment.py
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentRequest(BaseModel):
    reservation_id: int
    amount: float
    
class PaymentResponse(BaseModel):
    tid: str
    next_redirect_pc_url: str
    created_at: datetime

class PaymentApprovalRequest(BaseModel):
    pg_token: str
    tid: str

class RefundRequest(BaseModel):
    tid: str
    cancel_amount: float
    cancel_tax_free_amount: float = 0

# app/services/kakao_pay.py
import requests
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class KakaoPayService:
    def __init__(self):
        self.base_url = "https://kapi.kakao.com/v1/payment"
        self.admin_key = settings.KAKAO_ADMIN_KEY
        self.cid = settings.KAKAO_CID  # 가맹점 코드
        self.headers = {
            "Authorization": f"KakaoAK {self.admin_key}",
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        }
    
    def ready_payment(self, reservation_id: int, amount: int, user_id: str) -> dict:
        """결제 준비 API 호출"""
        url = f"{self.base_url}/ready"
        
        data = {
            "cid": self.cid,
            "partner_order_id": f"RESV_{reservation_id}",
            "partner_user_id": user_id,
            "item_name": f"예약금 결제 - 예약번호 {reservation_id}",
            "quantity": 1,
            "total_amount": amount,
            "tax_free_amount": 0,
            "approval_url": f"{settings.FRONTEND_URL}/payment/success",
            "cancel_url": f"{settings.FRONTEND_URL}/payment/cancel",
            "fail_url": f"{settings.FRONTEND_URL}/payment/fail"
        }
        
        try:
            response = requests.post(url, headers=self.headers, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"카카오페이 결제 준비 실패: {e}")
            raise Exception("결제 준비 중 오류가 발생했습니다.")
    
    def approve_payment(self, tid: str, pg_token: str, reservation_id: int, user_id: str) -> dict:
        """결제 승인 API 호출"""
        url = f"{self.base_url}/approve"
        
        data = {
            "cid": self.cid,
            "tid": tid,
            "partner_order_id": f"RESV_{reservation_id}",
            "partner_user_id": user_id,
            "pg_token": pg_token
        }
        
        try:
            response = requests.post(url, headers=self.headers, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"카카오페이 결제 승인 실패: {e}")
            raise Exception("결제 승인 중 오류가 발생했습니다.")
    
    def cancel_payment(self, tid: str, cancel_amount: int, cancel_tax_free_amount: int = 0) -> dict:
        """결제 취소(환불) API 호출"""
        url = f"{self.base_url}/cancel"
        
        data = {
            "cid": self.cid,
            "tid": tid,
            "cancel_amount": cancel_amount,
            "cancel_tax_free_amount": cancel_tax_free_amount
        }
        
        try:
            response = requests.post(url, headers=self.headers, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"카카오페이 결제 취소 실패: {e}")
            raise Exception("결제 취소 중 오류가 발생했습니다.")

# app/api/v1/endpoints/payment.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.payment import Payment, PaymentStatus
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.payment import (
    PaymentRequest, 
    PaymentResponse, 
    PaymentApprovalRequest,
    RefundRequest
)
from app.services.kakao_pay import KakaoPayService
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from datetime import datetime

router = APIRouter()
kakao_pay_service = KakaoPayService()

@router.post("/ready", response_model=PaymentResponse)
async def ready_payment(
    payment_request: PaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """카카오페이 결제 준비"""
    # 예약 정보 확인
    reservation = db.query(Reservation).filter(
        Reservation.id == payment_request.reservation_id,
        Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="예약 정보를 찾을 수 없습니다."
        )
    
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="결제 가능한 예약 상태가 아닙니다."
        )
    
    # 기존 결제 정보 확인
    existing_payment = db.query(Payment).filter(
        Payment.reservation_id == reservation.id,
        Payment.status == PaymentStatus.COMPLETED
    ).first()
    
    if existing_payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 결제가 완료된 예약입니다."
        )
    
    try:
        # 카카오페이 결제 준비 API 호출
        result = kakao_pay_service.ready_payment(
            reservation_id=reservation.id,
            amount=int(payment_request.amount),
            user_id=str(current_user.id)
        )
        
        # 결제 정보 저장
        payment = Payment(
            reservation_id=reservation.id,
            tid=result['tid'],
            amount=payment_request.amount,
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()
        
        return PaymentResponse(
            tid=result['tid'],
            next_redirect_pc_url=result['next_redirect_pc_url'],
            created_at=payment.created_at
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/approve")
async def approve_payment(
    approval_request: PaymentApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """카카오페이 결제 승인"""
    # 결제 정보 조회
    payment = db.query(Payment).filter(
        Payment.tid == approval_request.tid
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="결제 정보를 찾을 수 없습니다."
        )
    
    # 예약 정보 확인
    reservation = db.query(Reservation).filter(
        Reservation.id == payment.reservation_id,
        Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )
    
    try:
        # 카카오페이 결제 승인 API 호출
        result = kakao_pay_service.approve_payment(
            tid=approval_request.tid,
            pg_token=approval_request.pg_token,
            reservation_id=reservation.id,
            user_id=str(current_user.id)
        )
        
        # 결제 상태 업데이트
        payment.status = PaymentStatus.COMPLETED
        payment.updated_at = datetime.utcnow()
        
        # 예약 상태 업데이트
        reservation.status = ReservationStatus.CONFIRMED
        reservation.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "message": "결제가 성공적으로 완료되었습니다.",
            "payment_id": payment.id,
            "reservation_id": reservation.id,
            "amount": result['amount']['total'],
            "approved_at": result['approved_at']
        }
        
    except Exception as e:
        db.rollback()
        payment.status = PaymentStatus.FAILED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/refund")
async def refund_payment(
    refund_request: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """카카오페이 결제 취소(환불)"""
    # 결제 정보 조회
    payment = db.query(Payment).filter(
        Payment.tid == refund_request.tid,
        Payment.status == PaymentStatus.COMPLETED
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="완료된 결제 정보를 찾을 수 없습니다."
        )
    
    # 예약 정보 확인
    reservation = db.query(Reservation).filter(
        Reservation.id == payment.reservation_id,
        Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )
    
    # 환불 가능 여부 확인 (예약 날짜 24시간 전까지만 환불 가능)
    from datetime import timedelta
    if reservation.reservation_date - datetime.utcnow() < timedelta(hours=24):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="예약 시간 24시간 전까지만 환불이 가능합니다."
        )
    
    try:
        # 카카오페이 환불 API 호출
        result = kakao_pay_service.cancel_payment(
            tid=refund_request.tid,
            cancel_amount=int(refund_request.cancel_amount),
            cancel_tax_free_amount=int(refund_request.cancel_tax_free_amount)
        )
        
        # 결제 상태 업데이트
        payment.status = PaymentStatus.REFUNDED
        payment.updated_at = datetime.utcnow()
        
        # 예약 상태 업데이트
        reservation.status = ReservationStatus.CANCELLED
        reservation.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "message": "환불이 성공적으로 처리되었습니다.",
            "payment_id": payment.id,
            "reservation_id": reservation.id,
            "refunded_amount": result['canceled_amount']['total'],
            "canceled_at": result['canceled_at']
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/status/{reservation_id}")
async def get_payment_status(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """결제 상태 조회"""
    # 예약 정보 확인
    reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id,
        Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="예약 정보를 찾을 수 없습니다."
        )
    
    # 결제 정보 조회
    payment = db.query(Payment).filter(
        Payment.reservation_id == reservation_id
    ).order_by(Payment.created_at.desc()).first()
    
    if not payment:
        return {
            "reservation_id": reservation_id,
            "payment_status": "NO_PAYMENT",
            "message": "결제 정보가 없습니다."
        }
    
    return {
        "reservation_id": reservation_id,
        "payment_id": payment.id,
        "tid": payment.tid,
        "amount": payment.amount,
        "payment_status": payment.status.value,
        "created_at": payment.created_at,
        "updated_at": payment.updated_at
    }

# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 기존 설정들...
    
    # 카카오페이 설정
    KAKAO_ADMIN_KEY: str
    KAKAO_CID: str = "TC0ONETIME"  # 테스트용 CID
    FRONTEND_URL: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"

settings = Settings()

# main.py에 라우터 추가
from app.api.v1.endpoints import payment

app.include_router(payment.router, prefix="/api/v1/payment", tags=["payment"])