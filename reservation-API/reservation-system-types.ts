// types/reservation.types.ts
export interface Reservation {
  id: string;
  store_id: string;
  user_id?: string;
  reserver_name: string;
  reserver_phone_number: string;
  reservation_date: Date;
  reservation_time: string;
  number_of_people: number;
  menu_items?: ReservationMenuItem[];
  discount_conditions?: string;
  request_notes?: string;
  status: ReservationStatus;
  total_amount?: number;
  deposit_amount?: number;
  created_at: Date;
  confirmed_at?: Date;
  cancelled_at?: Date;
  completed_at?: Date;
}

export interface ReservationMenuItem {
  menu_id: string;
  menu_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show'
}

export interface CreateReservationDTO {
  store_id: string;
  user_id?: string;
  reserver_name: string;
  reserver_phone_number: string;
  reservation_date: string;
  reservation_time: string;
  number_of_people: number;
  menu_items?: {
    menu_id: string;
    quantity: number;
  }[];
  discount_conditions?: string;
  request_notes?: string;
}

export interface UpdateReservationDTO {
  reservation_date?: string;
  reservation_time?: string;
  number_of_people?: number;
  request_notes?: string;
  status?: ReservationStatus;
}

export interface ReservationFilter {
  store_id?: string;
  user_id?: string;
  status?: ReservationStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// database/migrations/create_reservations_table.sql
/*
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reserver_name VARCHAR(100) NOT NULL,
    reserver_phone_number VARCHAR(20) NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    number_of_people INTEGER NOT NULL CHECK (number_of_people > 0),
    discount_conditions TEXT,
    request_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10, 2),
    deposit_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_reason TEXT,
    
    INDEX idx_reservations_store_date (store_id, reservation_date),
    INDEX idx_reservations_user (user_id),
    INDEX idx_reservations_status (status),
    INDEX idx_reservations_phone (reserver_phone_number)
);

CREATE TABLE reservation_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES menus(id),
    menu_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    
    INDEX idx_reservation_items (reservation_id)
);

-- 예약 시간 충돌 방지를 위한 함수
CREATE OR REPLACE FUNCTION check_reservation_conflict()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM reservations
        WHERE store_id = NEW.store_id
        AND reservation_date = NEW.reservation_date
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
        AND status IN ('pending', 'confirmed')
        AND (
            (NEW.reservation_time >= reservation_time AND 
             NEW.reservation_time < reservation_time + INTERVAL '2 hours')
            OR
            (reservation_time >= NEW.reservation_time AND 
             reservation_time < NEW.reservation_time + INTERVAL '2 hours')
        )
    ) THEN
        RAISE EXCEPTION 'Reservation time conflict';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_reservation_conflict_trigger
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION check_reservation_conflict();
*/