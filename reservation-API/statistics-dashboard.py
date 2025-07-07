# app/schemas/statistics.py
from pydantic import BaseModel
from datetime import datetime, date
from typing import List, Dict, Optional
from enum import Enum

class PeriodType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class TimeSlotStats(BaseModel):
    time_slot: str
    count: int
    percentage: float

class ServiceStats(BaseModel):
    service_name: str
    service_id: int
    count: int
    revenue: float
    percentage: float

class ReservationStats(BaseModel):
    period: str
    total_count: int
    confirmed_count: int
    cancelled_count: int
    completed_count: int
    no_show_count: int
    confirmation_rate: float
    cancellation_rate: float
    completion_rate: float

class RevenueStats(BaseModel):
    period: str
    total_revenue: float
    completed_payments: float
    refunded_amount: float
    net_revenue: float
    average_payment: float
    payment_count: int

class DashboardSummary(BaseModel):
    # 오늘 통계
    today_reservations: int
    today_revenue: float
    today_new_patients: int
    
    # 이번 달 통계
    month_reservations: int
    month_revenue: float
    month_growth_rate: float  # 전월 대비
    
    # 주요 지표
    average_rating: float
    total_reviews: int
    confirmation_rate: float
    popular_time_slots: List[TimeSlotStats]
    popular_services: List[ServiceStats]

class PeriodStatistics(BaseModel):
    start_date: date
    end_date: date
    reservations: List[ReservationStats]
    revenues: List[RevenueStats]
    total_reservations: int
    total_revenue: float
    average_daily_reservations: float
    average_daily_revenue: float

# app/api/v1/endpoints/statistics.py
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case, extract
from datetime import datetime, date, timedelta
from typing import Optional
from app.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.models.payment import Payment, PaymentStatus
from app.models.review import Review
from app.models.user import User
from app.models.hospital import Hospital
from app.models.medical_service import MedicalService
from app.schemas.statistics import (
    DashboardSummary, 
    PeriodStatistics, 
    PeriodType,
    TimeSlotStats,
    ServiceStats,
    ReservationStats,
    RevenueStats
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

def check_hospital_admin(current_user: User, hospital_id: int, db: Session):
    """병원 관리자 권한 확인"""
    hospital = db.query(Hospital).filter(
        Hospital.id == hospital_id,
        Hospital.admin_id == current_user.id
    ).first()
    
    if not hospital and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다."
        )
    
    return hospital

@router.get("/dashboard/{hospital_id}", response_model=DashboardSummary)
async def get_dashboard_summary(
    hospital_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """대시보드 요약 통계"""
    # 권한 확인
    check_hospital_admin(current_user, hospital_id, db)
    
    today = date.today()
    month_start = date(today.year, today.month, 1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    last_month_end = month_start - timedelta(days=1)
    
    # 오늘 예약 수
    today_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.hospital_id == hospital_id,
        func.date(Reservation.reservation_date) == today,
        Reservation.status != ReservationStatus.CANCELLED
    ).scalar() or 0
    
    # 오늘 매출
    today_revenue = db.query(func.sum(Payment.amount)).join(
        Reservation, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        func.date(Payment.created_at) == today,
        Payment.status == PaymentStatus.COMPLETED
    ).scalar() or 0
    
    # 오늘 신규 환자
    today_new_patients = db.query(func.count(func.distinct(Reservation.user_id))).filter(
        Reservation.hospital_id == hospital_id,
        func.date(Reservation.created_at) == today
    ).scalar() or 0
    
    # 이번 달 예약 수
    month_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.reservation_date >= month_start,
        Reservation.status != ReservationStatus.CANCELLED
    ).scalar() or 0
    
    # 이번 달 매출
    month_revenue = db.query(func.sum(Payment.amount)).join(
        Reservation, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        Payment.created_at >= month_start,
        Payment.status == PaymentStatus.COMPLETED
    ).scalar() or 0
    
    # 지난 달 매출 (성장률 계산용)
    last_month_revenue = db.query(func.sum(Payment.amount)).join(
        Reservation, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        Payment.created_at >= last_month_start,
        Payment.created_at <= last_month_end,
        Payment.status == PaymentStatus.COMPLETED
    ).scalar() or 0
    
    # 성장률 계산
    month_growth_rate = 0
    if last_month_revenue > 0:
        month_growth_rate = ((month_revenue - last_month_revenue) / last_month_revenue) * 100
    
    # 평균 평점
    rating_stats = db.query(
        func.avg(Review.rating),
        func.count(Review.id)
    ).filter(
        Review.hospital_id == hospital_id
    ).first()
    
    average_rating = round(rating_stats[0], 1) if rating_stats[0] else 0
    total_reviews = rating_stats[1] or 0
    
    # 확정률 (이번 달)
    total_reservations_month = db.query(func.count(Reservation.id)).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.created_at >= month_start
    ).scalar() or 0
    
    confirmed_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.created_at >= month_start,
        Reservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED])
    ).scalar() or 0
    
    confirmation_rate = 0
    if total_reservations_month > 0:
        confirmation_rate = (confirmed_reservations / total_reservations_month) * 100
    
    # 인기 시간대 (최근 30일)
    thirty_days_ago = today - timedelta(days=30)
    time_slot_stats = db.query(
        Reservation.time_slot,
        func.count(Reservation.id).label('count')
    ).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.reservation_date >= thirty_days_ago,
        Reservation.status != ReservationStatus.CANCELLED
    ).group_by(Reservation.time_slot).order_by(func.count(Reservation.id).desc()).limit(5).all()
    
    total_time_slot_reservations = sum(stat[1] for stat in time_slot_stats)
    popular_time_slots = []
    for time_slot, count in time_slot_stats:
        percentage = (count / total_time_slot_reservations * 100) if total_time_slot_reservations > 0 else 0
        popular_time_slots.append(TimeSlotStats(
            time_slot=time_slot,
            count=count,
            percentage=round(percentage, 1)
        ))
    
    # 인기 서비스 (최근 30일)
    service_stats = db.query(
        MedicalService.name,
        MedicalService.id,
        func.count(Reservation.id).label('count'),
        func.sum(Payment.amount).label('revenue')
    ).join(
        Reservation, MedicalService.id == Reservation.service_id
    ).outerjoin(
        Payment, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.reservation_date >= thirty_days_ago,
        Reservation.status != ReservationStatus.CANCELLED
    ).group_by(MedicalService.id, MedicalService.name).order_by(func.count(Reservation.id).desc()).limit(5).all()
    
    total_service_revenue = sum(stat[3] or 0 for stat in service_stats)
    popular_services = []
    for service_name, service_id, count, revenue in service_stats:
        percentage = (revenue / total_service_revenue * 100) if total_service_revenue > 0 and revenue else 0
        popular_services.append(ServiceStats(
            service_name=service_name,
            service_id=service_id,
            count=count,
            revenue=revenue or 0,
            percentage=round(percentage, 1)
        ))
    
    return DashboardSummary(
        today_reservations=today_reservations,
        today_revenue=today_revenue,
        today_new_patients=today_new_patients,
        month_reservations=month_reservations,
        month_revenue=month_revenue,
        month_growth_rate=round(month_growth_rate, 1),
        average_rating=average_rating,
        total_reviews=total_reviews,
        confirmation_rate=round(confirmation_rate, 1),
        popular_time_slots=popular_time_slots,
        popular_services=popular_services
    )

@router.get("/period/{hospital_id}", response_model=PeriodStatistics)
async def get_period_statistics(
    hospital_id: int,
    start_date: date = Query(..., description="시작 날짜"),
    end_date: date = Query(..., description="종료 날짜"),
    period_type: PeriodType = Query(PeriodType.DAILY, description="집계 단위"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """기간별 상세 통계"""
    # 권한 확인
    check_hospital_admin(current_user, hospital_id, db)
    
    # 날짜 유효성 검사
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="시작 날짜는 종료 날짜보다 이전이어야 합니다."
        )
    
    # 기간별 예약 통계
    reservation_stats = []
    revenue_stats = []
    
    if period_type == PeriodType.DAILY:
        # 일별 통계
        current_date = start_date
        while current_date <= end_date:
            # 예약 통계
            stats = get_daily_reservation_stats(db, hospital_id, current_date)
            reservation_stats.append(stats)
            
            # 매출 통계
            revenue = get_daily_revenue_stats(db, hospital_id, current_date)
            revenue_stats.append(revenue)
            
            current_date += timedelta(days=1)
            
    elif period_type == PeriodType.WEEKLY:
        # 주별 통계
        current_date = start_date
        while current_date <= end_date:
            week_end = min(current_date + timedelta(days=6), end_date)
            
            # 예약 통계
            stats = get_period_reservation_stats(db, hospital_id, current_date, week_end)
            stats.period = f"{current_date.strftime('%Y-%m-%d')} ~ {week_end.strftime('%Y-%m-%d')}"
            reservation_stats.append(stats)
            
            # 매출 통계
            revenue = get_period_revenue_stats(db, hospital_id, current_date, week_end)
            revenue.period = f"{current_date.strftime('%Y-%m-%d')} ~ {week_end.strftime('%Y-%m-%d')}"
            revenue_stats.append(revenue)
            
            current_date += timedelta(days=7)
            
    elif period_type == PeriodType.MONTHLY:
        # 월별 통계
        current_date = start_date.replace(day=1)
        while current_date <= end_date:
            if current_date.month == 12:
                next_month = current_date.replace(year=current_date.year + 1, month=1)
            else:
                next_month = current_date.replace(month=current_date.month + 1)
            month_end = min(next_month - timedelta(days=1), end_date)
            
            # 예약 통계
            stats = get_period_reservation_stats(db, hospital_id, current_date, month_end)
            stats.period = current_date.strftime('%Y-%m')
            reservation_stats.append(stats)
            
            # 매출 통계
            revenue = get_period_revenue_stats(db, hospital_id, current_date, month_end)
            revenue.period = current_date.strftime('%Y-%m')
            revenue_stats.append(revenue)
            
            current_date = next_month
    
    # 전체 통계
    total_reservations = sum(stat.total_count for stat in reservation_stats)
    total_revenue = sum(stat.total_revenue for stat in revenue_stats)
    
    days_count = (end_date - start_date).days + 1
    avg_daily_reservations = total_reservations / days_count if days_count > 0 else 0
    avg_daily_revenue = total_revenue / days_count if days_count > 0 else 0
    
    return PeriodStatistics(
        start_date=start_date,
        end_date=end_date,
        reservations=reservation_stats,
        revenues=revenue_stats,
        total_reservations=total_reservations,
        total_revenue=total_revenue,
        average_daily_reservations=round(avg_daily_reservations, 1),
        average_daily_revenue=round(avg_daily_revenue, 2)
    )

def get_daily_reservation_stats(db: Session, hospital_id: int, date: date) -> ReservationStats:
    """일별 예약 통계"""
    base_query = db.query(Reservation).filter(
        Reservation.hospital_id == hospital_id,
        func.date(Reservation.reservation_date) == date
    )
    
    total = base_query.count()
    confirmed = base_query.filter(Reservation.status == ReservationStatus.CONFIRMED).count()
    cancelled = base_query.filter(Reservation.status == ReservationStatus.CANCELLED).count()
    completed = base_query.filter(Reservation.status == ReservationStatus.COMPLETED).count()
    no_show = base_query.filter(Reservation.status == ReservationStatus.NO_SHOW).count()
    
    return ReservationStats(
        period=date.strftime('%Y-%m-%d'),
        total_count=total,
        confirmed_count=confirmed,
        cancelled_count=cancelled,
        completed_count=completed,
        no_show_count=no_show,
        confirmation_rate=round((confirmed / total * 100) if total > 0 else 0, 1),
        cancellation_rate=round((cancelled / total * 100) if total > 0 else 0, 1),
        completion_rate=round((completed / total * 100) if total > 0 else 0, 1)
    )

def get_period_reservation_stats(db: Session, hospital_id: int, start: date, end: date) -> ReservationStats:
    """기간별 예약 통계"""
    base_query = db.query(Reservation).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.reservation_date >= start,
        Reservation.reservation_date <= end
    )
    
    total = base_query.count()
    confirmed = base_query.filter(Reservation.status == ReservationStatus.CONFIRMED).count()
    cancelled = base_query.filter(Reservation.status == ReservationStatus.CANCELLED).count()
    completed = base_query.filter(Reservation.status == ReservationStatus.COMPLETED).count()
    no_show = base_query.filter(Reservation.status == ReservationStatus.NO_SHOW).count()
    
    return ReservationStats(
        period="",  # 호출하는 곳에서 설정
        total_count=total,
        confirmed_count=confirmed,
        cancelled_count=cancelled,
        completed_count=completed,
        no_show_count=no_show,
        confirmation_rate=round((confirmed / total * 100) if total > 0 else 0, 1),
        cancellation_rate=round((cancelled / total * 100) if total > 0 else 0, 1),
        completion_rate=round((completed / total * 100) if total > 0 else 0, 1)
    )

def get_daily_revenue_stats(db: Session, hospital_id: int, date: date) -> RevenueStats:
    """일별 매출 통계"""
    payments = db.query(
        func.count(Payment.id),
        func.sum(case((Payment.status == PaymentStatus.COMPLETED, Payment.amount), else_=0)),
        func.sum(case((Payment.status == PaymentStatus.REFUNDED, Payment.amount), else_=0))
    ).join(
        Reservation, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        func.date(Payment.created_at) == date
    ).first()
    
    payment_count = payments[0] or 0
    completed_amount = payments[1] or 0
    refunded_amount = payments[2] or 0
    
    return RevenueStats(
        period=date.strftime('%Y-%m-%d'),
        total_revenue=completed_amount,
        completed_payments=completed_amount,
        refunded_amount=refunded_amount,
        net_revenue=completed_amount - refunded_amount,
        average_payment=round(completed_amount / payment_count if payment_count > 0 else 0, 2),
        payment_count=payment_count
    )

def get_period_revenue_stats(db: Session, hospital_id: int, start: date, end: date) -> RevenueStats:
    """기간별 매출 통계"""
    payments = db.query(
        func.count(Payment.id),
        func.sum(case((Payment.status == PaymentStatus.COMPLETED, Payment.amount), else_=0)),
        func.sum(case((Payment.status == PaymentStatus.REFUNDED, Payment.amount), else_=0))
    ).join(
        Reservation, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        Payment.created_at >= start,
        Payment.created_at <= end
    ).first()
    
    payment_count = payments[0] or 0
    completed_amount = payments[1] or 0
    refunded_amount = payments[2] or 0
    
    return RevenueStats(
        period="",  # 호출하는 곳에서 설정
        total_revenue=completed_amount,
        completed_payments=completed_amount,
        refunded_amount=refunded_amount,
        net_revenue=completed_amount - refunded_amount,
        average_payment=round(completed_amount / payment_count if payment_count > 0 else 0, 2),
        payment_count=payment_count
    )

@router.get("/export/{hospital_id}")
async def export_statistics(
    hospital_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str = Query("csv", regex="^(csv|excel)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """통계 데이터 내보내기"""
    # 권한 확인
    check_hospital_admin(current_user, hospital_id, db)
    
    # 데이터 조회
    reservations = db.query(
        Reservation.id,
        Reservation.reservation_date,
        Reservation.time_slot,
        User.name.label('patient_name'),
        MedicalService.name.label('service_name'),
        Reservation.status,
        Payment.amount,
        Payment.status.label('payment_status')
    ).join(
        User, Reservation.user_id == User.id
    ).join(
        MedicalService, Reservation.service_id == MedicalService.id
    ).outerjoin(
        Payment, Payment.reservation_id == Reservation.id
    ).filter(
        Reservation.hospital_id == hospital_id,
        Reservation.reservation_date >= start_date,
        Reservation.reservation_date <= end_date
    ).all()
    
    if format == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 헤더
        writer.writerow(['예약ID', '예약일시', '시간대', '환자명', '서비스', '예약상태', '결제금액', '결제상태'])
        
        # 데이터
        for row in reservations:
            writer.writerow([
                row.id,
                row.reservation_date.strftime('%Y-%m-%d'),
                row.time_slot,
                row.patient_name,
                row.service_name,
                row.status.value if row.status else '',
                row.amount or 0,
                row.payment_status.value if row.payment_status else '미결제'
            ])
        
        output.seek(0)
        return {
            "filename": f"hospital_{hospital_id}_stats_{start_date}_{end_date}.csv",
            "content": output.getvalue(),
            "content_type": "text/csv"
        }
    
    # Excel 형식은 추가 구현 필요
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Excel 형식은 아직 지원되지 않습니다."
    )

# main.py에 라우터 추가
from app.api.v1.endpoints import statistics

app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["statistics"])