-- Migration 20261015000017_seed_college_timing_slots.sql
-- Aligns timetable_slots with exact 9:00 AM - 4:30 PM schedule, 50-minute periods, 12:20 PM Recess (50 min)

DELETE FROM public.timetable_slots WHERE institution_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.timetable_slots (institution_id, slot_number, start_time, end_time, is_break, label)
VALUES
('00000000-0000-0000-0000-000000000001', 1, '09:00:00', '09:50:00', false, 'Period 1'),
('00000000-0000-0000-0000-000000000001', 2, '09:50:00', '10:40:00', false, 'Period 2'),
('00000000-0000-0000-0000-000000000001', 3, '10:40:00', '11:30:00', false, 'Period 3'),
('00000000-0000-0000-0000-000000000001', 4, '11:30:00', '12:20:00', false, 'Period 4'),
('00000000-0000-0000-0000-000000000001', 5, '12:20:00', '13:10:00', true,  'Recess / Lunch'),
('00000000-0000-0000-0000-000000000001', 6, '13:10:00', '14:00:00', false, 'Period 5'),
('00000000-0000-0000-0000-000000000001', 7, '14:00:00', '14:50:00', false, 'Period 6'),
('00000000-0000-0000-0000-000000000001', 8, '14:50:00', '15:40:00', false, 'Period 7'),
('00000000-0000-0000-0000-000000000001', 9, '15:40:00', '16:30:00', false, 'Period 8')
ON CONFLICT (institution_id, slot_number) DO NOTHING;
