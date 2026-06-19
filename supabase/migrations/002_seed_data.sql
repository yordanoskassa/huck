-- Seed Drivers
INSERT INTO drivers (name, current_city, current_state, current_lat, current_lng, hos_remaining_hours, truck_type, trailer_type, available, mc_number, phone) VALUES
('Marcus Johnson', 'Atlanta', 'GA', 33.749, -84.388, 9.5, 'Freightliner Cascadia', 'Dry Van', true, 'MC-845721', '555-0101'),
('Sarah Chen', 'Dallas', 'TX', 32.777, -96.797, 7.0, 'Kenworth T680', 'Reefer', true, 'MC-923456', '555-0102'),
('James Williams', 'Chicago', 'IL', 41.878, -87.630, 10.0, 'Peterbilt 579', 'Dry Van', true, 'MC-712389', '555-0103'),
('Maria Rodriguez', 'Los Angeles', 'CA', 34.052, -118.244, 8.5, 'Volvo VNL 860', 'Flatbed', true, 'MC-654321', '555-0104'),
('David Thompson', 'Memphis', 'TN', 35.150, -90.049, 11.0, 'International LT', 'Dry Van', true, 'MC-498765', '555-0105');

-- Seed Loads (15 loads across major lanes)
-- All broker_phone values use a placeholder; user should update to their own number for demo
INSERT INTO loads (origin_city, origin_state, origin_lat, origin_lng, dest_city, dest_state, dest_lat, dest_lng, posted_rate, rate_per_mile, broker_name, broker_phone, equipment_type, weight, miles, pickup_date, status, source) VALUES
-- Above-spot loads (accept strategy)
('Atlanta', 'GA', 33.749, -84.388, 'Dallas', 'TX', 32.777, -96.797, 3200.00, 4.10, 'TQL Logistics', '555-0201', 'Dry Van', 42000, 780, CURRENT_DATE + 1, 'available', 'DAT'),
('Chicago', 'IL', 41.878, -87.630, 'Memphis', 'TN', 35.150, -90.049, 2100.00, 4.20, 'CH Robinson', '555-0202', 'Dry Van', 38000, 500, CURRENT_DATE + 1, 'available', 'DAT'),
('Los Angeles', 'CA', 34.052, -118.244, 'Phoenix', 'AZ', 33.449, -112.074, 1800.00, 4.74, 'Echo Global', '555-0203', 'Flatbed', 35000, 380, CURRENT_DATE + 2, 'available', 'DAT'),
('Dallas', 'TX', 32.777, -96.797, 'Atlanta', 'GA', 33.749, -84.388, 3100.00, 3.97, 'XPO Logistics', '555-0204', 'Dry Van', 44000, 780, CURRENT_DATE + 1, 'available', 'DAT'),
('Memphis', 'TN', 35.150, -90.049, 'Chicago', 'IL', 41.878, -87.630, 2050.00, 4.10, 'Coyote Logistics', '555-0205', 'Dry Van', 40000, 500, CURRENT_DATE + 2, 'available', 'DAT'),

-- At-spot loads (accept strategy)
('Atlanta', 'GA', 33.749, -84.388, 'Miami', 'FL', 25.762, -80.192, 1950.00, 2.93, 'Landstar', '555-0206', 'Reefer', 36000, 665, CURRENT_DATE + 1, 'available', 'DAT'),
('Houston', 'TX', 29.760, -95.370, 'Dallas', 'TX', 32.777, -96.797, 850.00, 3.40, 'Werner Logistics', '555-0207', 'Dry Van', 30000, 250, CURRENT_DATE + 1, 'available', 'DAT'),
('Nashville', 'TN', 36.163, -86.781, 'Atlanta', 'GA', 33.749, -84.388, 750.00, 3.00, 'Schneider', '555-0208', 'Dry Van', 28000, 250, CURRENT_DATE + 2, 'available', 'DAT'),

-- Below-spot loads (negotiate strategy)
('Chicago', 'IL', 41.878, -87.630, 'Dallas', 'TX', 32.777, -96.797, 2400.00, 2.53, 'JB Hunt Transport', '555-0209', 'Dry Van', 43000, 950, CURRENT_DATE + 1, 'available', 'DAT'),
('Los Angeles', 'CA', 34.052, -118.244, 'Dallas', 'TX', 32.777, -96.797, 3200.00, 2.33, 'Convoy', '555-0210', 'Dry Van', 40000, 1375, CURRENT_DATE + 2, 'available', 'DAT'),
('Dallas', 'TX', 32.777, -96.797, 'Chicago', 'IL', 41.878, -87.630, 2200.00, 2.32, 'Uber Freight', '555-0211', 'Reefer', 38000, 950, CURRENT_DATE + 1, 'available', 'DAT'),
('Memphis', 'TN', 35.150, -90.049, 'Atlanta', 'GA', 33.749, -84.388, 800.00, 2.11, 'Total Quality', '555-0212', 'Dry Van', 35000, 380, CURRENT_DATE + 2, 'available', 'DAT'),
('Phoenix', 'AZ', 33.449, -112.074, 'Los Angeles', 'CA', 34.052, -118.244, 900.00, 2.37, 'RXO', '555-0213', 'Flatbed', 32000, 380, CURRENT_DATE + 1, 'available', 'DAT'),
('Atlanta', 'GA', 33.749, -84.388, 'Chicago', 'IL', 41.878, -87.630, 1800.00, 2.47, 'Transplace', '555-0214', 'Dry Van', 41000, 730, CURRENT_DATE + 2, 'available', 'DAT'),
('Houston', 'TX', 29.760, -95.370, 'Memphis', 'TN', 35.150, -90.049, 1200.00, 2.09, 'Arrive Logistics', '555-0215', 'Dry Van', 39000, 575, CURRENT_DATE + 1, 'available', 'DAT');

-- Seed Spot Rates (matching lanes)
INSERT INTO spot_rates (origin_city, origin_state, dest_city, dest_state, equipment_type, rate_per_mile, avg_rate, high_rate, low_rate) VALUES
('Atlanta', 'GA', 'Dallas', 'TX', 'Dry Van', 3.20, 2500.00, 3000.00, 2100.00),
('Chicago', 'IL', 'Memphis', 'TN', 'Dry Van', 3.40, 1700.00, 2000.00, 1400.00),
('Los Angeles', 'CA', 'Phoenix', 'AZ', 'Flatbed', 3.80, 1450.00, 1700.00, 1200.00),
('Dallas', 'TX', 'Atlanta', 'GA', 'Dry Van', 3.10, 2420.00, 2900.00, 2000.00),
('Memphis', 'TN', 'Chicago', 'IL', 'Dry Van', 3.30, 1650.00, 1950.00, 1350.00),
('Atlanta', 'GA', 'Miami', 'FL', 'Reefer', 2.90, 1930.00, 2200.00, 1650.00),
('Houston', 'TX', 'Dallas', 'TX', 'Dry Van', 3.20, 800.00, 950.00, 650.00),
('Nashville', 'TN', 'Atlanta', 'GA', 'Dry Van', 2.80, 700.00, 850.00, 550.00),
('Chicago', 'IL', 'Dallas', 'TX', 'Dry Van', 3.10, 2950.00, 3400.00, 2500.00),
('Los Angeles', 'CA', 'Dallas', 'TX', 'Dry Van', 2.80, 3850.00, 4500.00, 3200.00),
('Dallas', 'TX', 'Chicago', 'IL', 'Reefer', 3.20, 3040.00, 3500.00, 2600.00),
('Memphis', 'TN', 'Atlanta', 'GA', 'Dry Van', 2.80, 1065.00, 1250.00, 880.00),
('Phoenix', 'AZ', 'Los Angeles', 'CA', 'Flatbed', 3.50, 1330.00, 1550.00, 1100.00),
('Atlanta', 'GA', 'Chicago', 'IL', 'Dry Van', 3.00, 2190.00, 2600.00, 1800.00),
('Houston', 'TX', 'Memphis', 'TN', 'Dry Van', 2.90, 1670.00, 1950.00, 1400.00);
