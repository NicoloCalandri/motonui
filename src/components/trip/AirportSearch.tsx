'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

// ─── Static airport dataset (major world airports) ────────────────────────────
// Format: [IATA, City, AirportName, CountryCode]
const AIRPORTS: [string, string, string, string, number, number][] = [
    ['FCO', 'Roma', 'Leonardo da Vinci (Fiumicino)', 'IT', 41.7999, 12.2462],
    ['CIA', 'Roma', 'Ciampino', 'IT', 41.7994, 12.5949],
    ['MXP', 'Milano', 'Malpensa', 'IT', 45.6301, 8.7231],
    ['LIN', 'Milano', 'Linate', 'IT', 45.4545, 9.2768],
    ['BGY', 'Bergamo', 'Orio al Serio', 'IT', 45.6739, 9.7042],
    ['TRN', 'Torino', 'Caselle', 'IT', 45.1976, 7.6497],
    ['VCE', 'Venezia', 'Marco Polo', 'IT', 45.5053, 12.3519],
    ['TSF', 'Treviso', 'Canova', 'IT', 45.6484, 12.1943],
    ['BLQ', 'Bologna', 'Guglielmo Marconi', 'IT', 44.5354, 11.2887],
    ['FLR', 'Firenze', 'Amerigo Vespucci', 'IT', 43.8100, 11.2051],
    ['PSA', 'Pisa', 'Galileo Galilei', 'IT', 43.6839, 10.3927],
    ['NAP', 'Napoli', 'Capodichino', 'IT', 40.8860, 14.2908],
    ['BRI', 'Bari', 'Karol Wojtyla', 'IT', 41.1389, 16.7626],
    ['CTA', 'Catania', 'Fontanarossa', 'IT', 37.4668, 15.0664],
    ['PMO', 'Palermo', 'Falcone-Borsellino', 'IT', 38.1760, 13.0910],
    ['CAG', 'Cagliari', 'Elmas', 'IT', 39.2515, 9.0543],
    ['PMF', 'Parma', 'Giuseppe Verdi', 'IT', 44.8245, 10.2963],
    ['GOA', 'Genova', 'Cristoforo Colombo', 'IT', 44.4133, 8.8375],
    ['REG', 'Reggio Calabria', 'Tito Minniti', 'IT', 38.0712, 15.6516],
    ['CRV', 'Crotone', 'S. Anna', 'IT', 39.0822, 17.0802],
    ['BDS', 'Brindisi', 'Casale', 'IT', 40.6576, 17.9470],
    ['LCC', 'Lecce', 'Lepore', 'IT', 40.2392, 18.1333],
    ['SUF', 'Lamezia Terme', 'Lamezia Terme', 'IT', 38.9054, 16.2423],
    ['AHO', 'Alghero', 'Riviera del Corallo', 'IT', 40.6321, 8.2907],
    ['OLB', 'Olbia', 'Costa Smeralda', 'IT', 40.8987, 9.5178],
    ['LHR', 'Londra', 'Heathrow', 'GB', 51.4700, -0.4543],
    ['LGW', 'Londra', 'Gatwick', 'GB', 51.1481, -0.1903],
    ['STN', 'Londra', 'Stansted', 'GB', 51.8850, 0.2350],
    ['LTN', 'Londra', 'Luton', 'GB', 51.8747, -0.3683],
    ['LCY', 'Londra', 'City', 'GB', 51.5048, 0.0495],
    ['CDG', 'Parigi', 'Charles de Gaulle', 'FR', 49.0097, 2.5479],
    ['ORY', 'Parigi', 'Orly', 'FR', 48.7262, 2.3652],
    ['AMS', 'Amsterdam', 'Schiphol', 'NL', 52.3086, 4.7684],
    ['FRA', 'Francoforte', 'Frankfurt am Main', 'DE', 50.0379, 8.5622],
    ['MUC', 'Monaco', 'Franz Josef Strauss', 'DE', 48.3537, 11.7750],
    ['TXL', 'Berlino', 'Tegel (storico)', 'DE', 52.5597, 13.2877],
    ['BER', 'Berlino', 'Brandenburg', 'DE', 52.3667, 13.5033],
    ['HAM', 'Amburgo', 'Hamburg', 'DE', 53.6304, 9.9882],
    ['DUS', 'Düsseldorf', 'Düsseldorf', 'DE', 51.2895, 6.7668],
    ['MAD', 'Madrid', 'Adolfo Suárez Barajas', 'ES', 40.4936, -3.5668],
    ['BCN', 'Barcellona', 'El Prat', 'ES', 41.2971, 2.0785],
    ['AGP', 'Malaga', 'Costa del Sol', 'ES', 36.6750, -4.4991],
    ['PMI', 'Palma di Maiorca', 'Son Sant Joan', 'ES', 39.5517, 2.7388],
    ['VLC', 'Valencia', 'Valencia', 'ES', 39.4893, -0.4816],
    ['SVQ', 'Siviglia', 'San Pablo', 'ES', 37.4180, -5.8931],
    ['LIS', 'Lisbona', 'Humberto Delgado', 'PT', 38.7756, -9.1354],
    ['OPO', 'Porto', 'Sá Carneiro', 'PT', 41.2481, -8.6814],
    ['ATH', 'Atene', 'Eleftherios Venizelos', 'GR', 37.9364, 23.9445],
    ['SKG', 'Salonicco', 'Makedonia', 'GR', 40.5197, 22.9709],
    ['IST', 'Istanbul', 'Istanbul', 'TR', 41.2753, 28.7519],
    ['SAW', 'Istanbul', 'Sabiha Gökçen', 'TR', 40.8985, 29.3092],
    ['VIE', 'Vienna', 'Schwechat', 'AT', 48.1103, 16.5697],
    ['ZRH', 'Zurigo', 'Zürich Airport', 'CH', 47.4647, 8.5492],
    ['GVA', 'Ginevra', 'Cointrin', 'CH', 46.2381, 6.1090],
    ['BRU', 'Bruxelles', 'Zaventem', 'BE', 50.9014, 4.4844],
    ['CPH', 'Copenaghen', 'Kastrup', 'DK', 55.6180, 12.6560],
    ['ARN', 'Stoccolma', 'Arlanda', 'SE', 59.6519, 17.9186],
    ['OSL', 'Oslo', 'Gardermoen', 'NO', 60.1939, 11.1004],
    ['HEL', 'Helsinki', 'Vantaa', 'FI', 60.3172, 24.9633],
    ['DUB', 'Dublino', 'Dublin', 'IE', 53.4213, -6.2700],
    ['WAW', 'Varsavia', 'Chopin', 'PL', 52.1657, 20.9671],
    ['KRK', 'Cracovia', 'John Paul II', 'PL', 49.9968, 19.7848],
    ['PRG', 'Praga', 'Václav Havel', 'CZ', 50.1008, 14.2600],
    ['BUD', 'Budapest', 'Liszt Ferenc', 'HU', 47.4369, 19.2556],
    ['OTP', 'Bucarest', 'Henri Coandă', 'RO', 44.5722, 26.1020],
    ['SOF', 'Sofia', 'Sofia Airport', 'BG', 42.6952, 23.4114],
    ['BEG', 'Belgrado', 'Nikola Tesla', 'RS', 44.8184, 20.3091],
    ['ZAG', 'Zagabria', 'Franjo Tuđman', 'HR', 45.7429, 16.0688],
    ['LJU', 'Lubiana', 'Jože Pučnik', 'SI', 46.2237, 14.4576],
    ['TBS', 'Tbilisi', 'Shota Rustaveli', 'GE', 41.6692, 44.9547],
    ['GYD', 'Baku', 'Heydar Aliyev', 'AZ', 40.4675, 50.0467],
    ['EVN', 'Yerevan', 'Zvartnots', 'AM', 40.1473, 44.3959],
    ['JFK', 'New York', 'John F. Kennedy', 'US', 40.6413, -73.7781],
    ['LGA', 'New York', 'LaGuardia', 'US', 40.7769, -73.8740],
    ['EWR', 'New York', 'Newark', 'US', 40.6895, -74.1745],
    ['LAX', 'Los Angeles', 'Los Angeles Intl', 'US', 33.9425, -118.4081],
    ['ORD', 'Chicago', "O'Hare", 'US', 41.9742, -87.9073],
    ['MDW', 'Chicago', 'Midway', 'US', 41.7868, -87.7522],
    ['ATL', 'Atlanta', 'Hartsfield-Jackson', 'US', 33.6407, -84.4277],
    ['MIA', 'Miami', 'Miami Intl', 'US', 25.7959, -80.2870],
    ['SFO', 'San Francisco', 'San Francisco Intl', 'US', 37.6213, -122.3790],
    ['BOS', 'Boston', 'Logan', 'US', 42.3656, -71.0096],
    ['SEA', 'Seattle', 'Sea-Tac', 'US', 47.4502, -122.3088],
    ['DFW', 'Dallas', 'Dallas/Fort Worth', 'US', 32.8998, -97.0403],
    ['DEN', 'Denver', 'Denver Intl', 'US', 39.8561, -104.6737],
    ['LAS', 'Las Vegas', 'Harry Reid', 'US', 36.0840, -115.1537],
    ['PHX', 'Phoenix', 'Sky Harbor', 'US', 33.4373, -112.0078],
    ['MCO', 'Orlando', 'Orlando Intl', 'US', 28.4312, -81.3081],
    ['MSP', 'Minneapolis', 'Minneapolis–Saint Paul', 'US', 44.8848, -93.2223],
    ['DTW', 'Detroit', 'Detroit Metropolitan', 'US', 42.2162, -83.3554],
    ['IAD', 'Washington', 'Dulles', 'US', 38.9531, -77.4565],
    ['DCA', 'Washington', 'Reagan', 'US', 38.8512, -77.0402],
    ['BWI', 'Baltimora', 'BWI', 'US', 39.1754, -76.6683],
    ['IAH', 'Houston', 'George Bush', 'US', 29.9902, -95.3368],
    ['HOU', 'Houston', 'Hobby', 'US', 29.6454, -95.2789],
    ['BNA', 'Nashville', 'Nashville Intl', 'US', 36.1245, -86.6782],
    ['PHL', 'Philadelphia', 'Philadelphia Intl', 'US', 39.8744, -75.2424],
    ['YYZ', 'Toronto', 'Pearson', 'CA', 43.6777, -79.6248],
    ['YUL', 'Montreal', 'Trudeau', 'CA', 45.4706, -73.7408],
    ['YVR', 'Vancouver', 'Vancouver Intl', 'CA', 49.1967, -123.1815],
    ['YYC', 'Calgary', 'Calgary Intl', 'CA', 51.1225, -113.9901],
    ['MEX', 'Città del Messico', 'Benito Juárez', 'MX', 19.4363, -99.0721],
    ['CUN', 'Cancún', 'Cancún Intl', 'MX', 21.0365, -86.8771],
    ['GRU', 'San Paolo', 'Guarulhos', 'BR', -23.4356, -46.4731],
    ['GIG', 'Rio de Janeiro', 'Galeão', 'BR', -22.8099, -43.2506],
    ['SDU', 'Rio de Janeiro', 'Santos Dumont', 'BR', -22.9105, -43.1632],
    ['BSB', 'Brasilia', 'Presidente Juscelino Kubitschek', 'BR', -15.8711, -47.9187],
    ['SSA', 'Salvador', 'Deputado Luís Eduardo Magalhães', 'BR', -12.9111, -38.3225],
    ['FOR', 'Fortaleza', 'Pinto Martins', 'BR', -3.7763, -38.5326],
    ['REC', 'Recife', 'Guararapes', 'BR', -8.1265, -34.9234],
    ['MAO', 'Manaus', 'Eduardo Gomes', 'BR', -3.0386, -60.0497],
    ['SCL', 'Santiago', 'Arturo Merino Benítez', 'CL', -33.3930, -70.7858],
    ['EZE', 'Buenos Aires', 'Ezeiza', 'AR', -34.8222, -58.5358],
    ['AEP', 'Buenos Aires', 'Aeroparque Jorge Newbery', 'AR', -34.5592, -58.4156],
    ['LIM', 'Lima', 'Jorge Chávez', 'PE', -12.0219, -77.1143],
    ['BOG', 'Bogotá', 'El Dorado', 'CO', 4.7016, -74.1469],
    ['UIO', 'Quito', 'Mariscal Sucre', 'EC', -0.1293, -78.3575],
    ['GYE', 'Guayaquil', 'José Joaquín de Olmedo', 'EC', -2.1574, -79.8836],
    ['MVD', 'Montevideo', 'Carrasco', 'UY', -34.8384, -56.0308],
    ['ASU', 'Asunción', 'Silvio Pettirossi', 'PY', -25.2397, -57.5198],
    ['VVI', 'Santa Cruz', 'Viru Viru', 'BO', -17.6448, -63.1354],
    ['DXB', 'Dubai', 'Dubai Intl', 'AE', 25.2528, 55.3644],
    ['AUH', 'Abu Dhabi', 'Zayed', 'AE', 24.4330, 54.6511],
    ['DOH', 'Doha', 'Hamad', 'QA', 25.2609, 51.6138],
    ['RUH', 'Riad', 'King Khalid', 'SA', 24.9576, 46.6988],
    ['JED', 'Jeddah', 'King Abdulaziz', 'SA', 21.6796, 39.1565],
    ['KWI', 'Kuwait City', 'Kuwait', 'KW', 29.2269, 47.9689],
    ['BAH', 'Manama', 'Bahrain', 'BH', 26.2708, 50.6336],
    ['MCT', 'Mascate', 'Muscat', 'OM', 23.5932, 58.2844],
    ['BOM', 'Mumbai', 'Chhatrapati Shivaji', 'IN', 19.0896, 72.8656],
    ['DEL', 'New Delhi', 'Indira Gandhi', 'IN', 28.5562, 77.1000],
    ['BLR', 'Bengaluru', 'Kempegowda', 'IN', 13.1986, 77.7066],
    ['MAA', 'Chennai', 'Chennai Intl', 'IN', 12.9941, 80.1709],
    ['CCU', 'Calcutta', 'Netaji Subhas Chandra Bose', 'IN', 22.6547, 88.4467],
    ['HYD', 'Hyderabad', 'Rajiv Gandhi', 'IN', 17.2313, 78.4298],
    ['AMD', 'Ahmedabad', 'Sardar Vallabhbhai Patel', 'IN', 23.0771, 72.6347],
    ['COK', 'Kochi', 'Cochin', 'IN', 10.1521, 76.3995],
    ['SIN', 'Singapore', 'Changi', 'SG', 1.3644, 103.9915],
    ['KUL', 'Kuala Lumpur', 'KLIA', 'MY', 2.7456, 101.7099],
    ['BKK', 'Bangkok', 'Suvarnabhumi', 'TH', 13.6900, 100.7501],
    ['DMK', 'Bangkok', 'Don Mueang', 'TH', 13.9126, 100.6067],
    ['HKT', 'Phuket', 'Phuket', 'TH', 8.1132, 98.3160],
    ['CNX', 'Chiang Mai', 'Chiang Mai', 'TH', 18.7669, 98.9626],
    ['CGK', 'Giacarta', 'Soekarno-Hatta', 'ID', -6.1256, 106.6558],
    ['DPS', 'Bali/Denpasar', 'Ngurah Rai', 'ID', -8.7482, 115.1670],
    ['SUB', 'Surabaya', 'Juanda', 'ID', -7.3798, 112.7869],
    ['MNL', 'Manila', 'Ninoy Aquino', 'PH', 14.5086, 121.0194],
    ['CEB', 'Cebu', 'Mactan-Cebu', 'PH', 10.3075, 123.9790],
    ['SGN', 'Ho Chi Minh City', 'Tan Son Nhat', 'VN', 10.8188, 106.6520],
    ['HAN', 'Hanoi', 'Noi Bai', 'VN', 21.2183, 105.8041],
    ['DAD', 'Da Nang', 'Da Nang', 'VN', 16.0439, 108.1993],
    ['PNH', 'Phnom Penh', 'Phnom Penh', 'KH', 11.5466, 104.8441],
    ['REP', 'Siem Reap', 'Siem Reap', 'KH', 13.4107, 103.8132],
    ['RGN', 'Yangon', 'Mingaladon', 'MM', 16.9073, 96.1332],
    ['KTM', 'Kathmandu', 'Tribhuvan', 'NP', 27.6966, 85.3591],
    ['CMB', 'Colombo', 'Bandaranaike', 'LK', 7.1808, 79.8841],
    ['HND', 'Tokyo', 'Haneda', 'JP', 35.5494, 139.7798],
    ['NRT', 'Tokyo', 'Narita', 'JP', 35.7648, 140.3864],
    ['KIX', 'Osaka', 'Kansai', 'JP', 34.4347, 135.2440],
    ['NGO', 'Nagoya', 'Chubu Centrair', 'JP', 34.8583, 136.8054],
    ['FUK', 'Fukuoka', 'Fukuoka', 'JP', 33.5858, 130.4508],
    ['CTS', 'Sapporo', 'New Chitose', 'JP', 42.7752, 141.6920],
    ['OKA', 'Okinawa', 'Naha', 'JP', 26.1958, 127.6460],
    ['ICN', 'Seoul', 'Incheon', 'KR', 37.4602, 126.4407],
    ['GMP', 'Seoul', 'Gimpo', 'KR', 37.5586, 126.7944],
    ['PEK', 'Pechino', 'Capital', 'CN', 40.0801, 116.5846],
    ['PKX', 'Pechino', 'Daxing', 'CN', 39.5095, 116.4112],
    ['PVG', 'Shanghai', 'Pudong', 'CN', 31.1443, 121.8083],
    ['SHA', 'Shanghai', 'Hongqiao', 'CN', 31.1979, 121.3363],
    ['CAN', 'Guangzhou', 'Baiyun', 'CN', 23.3924, 113.2988],
    ['CTU', 'Chengdu', 'Shuangliu', 'CN', 30.5785, 103.9471],
    ['SZX', 'Shenzhen', 'Bao\'an', 'CN', 22.6392, 113.8107],
    ['HKG', 'Hong Kong', 'Hong Kong Intl', 'HK', 22.3080, 113.9185],
    ['TPE', 'Taipei', 'Taoyuan', 'TW', 25.0797, 121.2342],
    ['TSA', 'Taipei', 'Songshan', 'TW', 25.0694, 121.5522],
    ['SYD', 'Sydney', 'Kingsford Smith', 'AU', -33.9399, 151.1753],
    ['MEL', 'Melbourne', 'Tullamarine', 'AU', -37.6690, 144.8410],
    ['BNE', 'Brisbane', 'Brisbane Airport', 'AU', -27.3842, 153.1175],
    ['PER', 'Perth', 'Perth Airport', 'AU', -31.9403, 115.9669],
    ['ADL', 'Adelaide', 'Adelaide Airport', 'AU', -34.9450, 138.5302],
    ['AKL', 'Auckland', 'Auckland Intl', 'NZ', -37.0082, 174.7850],
    ['WLG', 'Wellington', 'Wellington Intl', 'NZ', -41.3272, 174.8052],
    ['CHC', 'Christchurch', 'Christchurch Intl', 'NZ', -43.4894, 172.5322],
    ['CAI', 'Il Cairo', 'Cairo Intl', 'EG', 30.1219, 31.4056],
    ['HRG', 'Hurghada', 'Hurghada', 'EG', 27.1783, 33.7994],
    ['SSH', 'Sharm el-Sheikh', 'Sharm el-Sheikh', 'EG', 27.9773, 34.3950],
    ['CMN', 'Casablanca', 'Mohammed V', 'MA', 33.3675, -7.5897],
    ['RAK', 'Marrakech', 'Menara', 'MA', 31.6069, -8.0363],
    ['NBO', 'Nairobi', 'Jomo Kenyatta', 'KE', -1.3192, 36.9275],
    ['MBA', 'Mombasa', 'Moi', 'KE', -4.0348, 39.5942],
    ['DAR', 'Dar es Salaam', 'Julius Nyerere', 'TZ', -6.8781, 39.2026],
    ['JNB', 'Johannesburg', 'O.R. Tambo', 'ZA', -26.1392, 28.2460],
    ['CPT', 'Città del Capo', 'Cape Town', 'ZA', -33.9648, 18.6017],
    ['DUR', 'Durban', 'King Shaka', 'ZA', -29.6144, 31.1197],
    ['ACC', 'Accra', 'Kotoka', 'GH', 5.6052, -0.1668],
    ['LOS', 'Lagos', 'Murtala Muhammed', 'NG', 6.5774, 3.3212],
    ['ABV', 'Abuja', 'Nnamdi Azikiwe', 'NG', 9.0068, 7.2632],
    ['ADD', 'Addis Abeba', 'Bole', 'ET', 8.9779, 38.7992],
    ['KGL', 'Kigali', 'Kigali', 'RW', -1.9686, 30.1395],
    ['EBB', 'Kampala', 'Entebbe', 'UG', 0.0424, 32.4435],
    ['BOJ', 'Burgas', 'Burgas', 'BG', 42.5697, 27.5150],
    ['VAR', 'Varna', 'Varna', 'BG', 43.2321, 27.8251],
    ['RHO', 'Rodi', 'Diagoras', 'GR', 36.4053, 28.0862],
    ['CFU', 'Corfù', 'Ioannis Kapodistrias', 'GR', 39.6019, 19.9115],
    ['HER', 'Creta/Heraklion', 'Nikos Kazantzakis', 'GR', 35.3397, 25.1803],
    ['CHQ', 'Creta/Chania', 'Daskalogiannis', 'GR', 35.5317, 24.1497],
    ['ZTH', 'Zante', 'Zakynthos', 'GR', 37.7509, 20.8843],
    ['KGS', 'Kos', 'Hippocrates', 'GR', 36.7934, 27.0916],
    ['JMK', 'Mykonos', 'Mykonos', 'GR', 37.4351, 25.3481],
    ['JTR', 'Santorini', 'Thira', 'GR', 36.3992, 25.4791],
    ['IBZ', 'Ibiza', 'Ibiza', 'ES', 38.8729, 1.3731],
    ['ACE', 'Lanzarote', 'Arrecife', 'ES', 28.9455, -13.6051],
    ['TFS', 'Tenerife Sud', 'Tenerife Sur', 'ES', 28.0445, -16.5725],
    ['TFN', 'Tenerife Nord', 'Los Rodeos', 'ES', 28.4827, -16.3414],
    ['LPA', 'Gran Canaria', 'Gran Canaria', 'ES', 27.9319, -15.3866],
    ['FUE', 'Fuerteventura', 'Fuerteventura', 'ES', 28.4997, -13.8638],
    ['MLN', 'Melilla', 'Melilla', 'ES', 35.2798, -2.9563],
    ['RVN', 'Rovaniemi', 'Rovaniemi', 'FI', 66.5648, 25.8304],
    ['KEM', 'Kemi-Tornio', 'Kemi-Tornio', 'FI', 65.7787, 24.5958],
    ['IVL', 'Ivalo', 'Ivalo', 'FI', 68.6073, 27.4053],
    ['KEF', 'Reykjavik', 'Keflavik', 'IS', 63.9850, -22.6056],
    ['BGO', 'Bergen', 'Flesland', 'NO', 60.2934, 5.2181],
    ['SVG', 'Stavanger', 'Sola', 'NO', 58.8768, 5.6378],
    ['TRD', 'Trondheim', 'Trondheim', 'NO', 63.4578, 10.9240],
    ['LYS', 'Lione', 'Saint-Exupéry', 'FR', 45.7256, 5.0811],
    ['NCE', 'Nizza', 'Côte d\'Azur', 'FR', 43.6584, 7.2159],
    ['MRS', 'Marsiglia', 'Provence', 'FR', 43.4393, 5.2214],
    ['TLS', 'Tolosa', 'Blagnac', 'FR', 43.6291, 1.3677],
    ['BOD', 'Bordeaux', 'Mérignac', 'FR', 44.8283, -0.7156],
    ['NTE', 'Nantes', 'Atlantique', 'FR', 47.1532, -1.6107],
    ['SXB', 'Strasburgo', 'Strasbourg Airport', 'FR', 48.5383, 7.6282],
    ['BSL', 'Basilea', 'EuroAirport', 'CH', 47.5896, 7.5299],
    ['BHX', 'Birmingham', 'Birmingham Airport', 'GB', 52.4539, -1.7480],
    ['MAN', 'Manchester', 'Manchester Airport', 'GB', 53.3537, -2.2750],
    ['EDI', 'Edimburgo', 'Edinburgh', 'GB', 55.9500, -3.3725],
    ['GLA', 'Glasgow', 'Glasgow Airport', 'GB', 55.8719, -4.4331],
    ['BFS', 'Belfast', 'Belfast Intl', 'GB', 54.6575, -6.2158],
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirportResult {
    iata: string;
    city: string;
    name: string;
    countryCode: string;
    /** Human-friendly label shown in the input after selection */
    label: string;
    lat: number;
    lng: number;
}

interface AirportSearchProps {
    placeholder?: string;
    initialValue?: string;
    onSelect: (result: AirportResult) => void;
    onTextChange?: (text: string) => void;
}

// ─── Search logic ─────────────────────────────────────────────────────────────

function searchAirports(query: string): AirportResult[] {
    const q = query.trim().toUpperCase();
    if (!q || q.length < 2) return [];

    const qLower = q.toLowerCase();

    return AIRPORTS
        .filter(([iata, city, name]) =>
            iata.startsWith(q) ||
            city.toLowerCase().includes(qLower) ||
            name.toLowerCase().includes(qLower)
        )
        .slice(0, 8)
        .map(([iata, city, name, countryCode, lat, lng]) => ({
            iata,
            city,
            name,
            countryCode,
            label: `${iata} — ${city}`,
            lat,
            lng,
        }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AirportSearch({ placeholder, initialValue, onSelect, onTextChange }: AirportSearchProps) {
    const [query, setQuery] = useState(initialValue ?? '');
    const [results, setResults] = useState<AirportResult[]>([]);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(initialValue ?? '');
    }, [initialValue]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        onTextChange?.(val);
        const found = searchAirports(val);
        setResults(found);
        setOpen(found.length > 0);
    };

    const handleSelect = (result: AirportResult) => {
        setQuery(result.label);
        setOpen(false);
        onSelect(result);
    };

    return (
        <div className="relative" ref={containerRef}>
            <input
                type="text"
                value={query}
                onChange={handleChange}
                onFocus={() => query.length >= 2 && setOpen(results.length > 0)}
                placeholder={placeholder ?? 'Codice IATA o città (es. TRN, Roma)'}
                className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-sm"
                autoComplete="off"
            />

            {open && results.length > 0 && (
                <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden">
                    {results.map((r) => (
                        <li key={r.iata}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(r)}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                            >
                                <span className="font-mono font-black text-sm text-neutral-900 w-10 flex-shrink-0 bg-neutral-100 rounded-lg px-1.5 py-0.5 text-center">
                                    {r.iata}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-neutral-900 truncate">{r.city}</p>
                                    <p className="text-xs text-neutral-400 truncate">{r.name}</p>
                                </div>
                                <span className="ml-auto text-xs text-neutral-300 flex-shrink-0">{r.countryCode}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
