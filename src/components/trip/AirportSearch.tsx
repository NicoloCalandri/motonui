'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

// ─── Static airport dataset (major world airports) ────────────────────────────
// Format: [IATA, City, AirportName, CountryCode]
const AIRPORTS: [string, string, string, string][] = [
    ['FCO', 'Roma', 'Leonardo da Vinci (Fiumicino)', 'IT'],
    ['CIA', 'Roma', 'Ciampino', 'IT'],
    ['MXP', 'Milano', 'Malpensa', 'IT'],
    ['LIN', 'Milano', 'Linate', 'IT'],
    ['BGY', 'Bergamo', 'Orio al Serio', 'IT'],
    ['TRN', 'Torino', 'Caselle', 'IT'],
    ['VCE', 'Venezia', 'Marco Polo', 'IT'],
    ['TSF', 'Treviso', 'Canova', 'IT'],
    ['BLQ', 'Bologna', 'Guglielmo Marconi', 'IT'],
    ['FLR', 'Firenze', 'Amerigo Vespucci', 'IT'],
    ['PSA', 'Pisa', 'Galileo Galilei', 'IT'],
    ['NAP', 'Napoli', 'Capodichino', 'IT'],
    ['BRI', 'Bari', 'Karol Wojtyla', 'IT'],
    ['CTA', 'Catania', 'Fontanarossa', 'IT'],
    ['PMO', 'Palermo', 'Falcone-Borsellino', 'IT'],
    ['CAG', 'Cagliari', 'Elmas', 'IT'],
    ['PMF', 'Parma', 'Giuseppe Verdi', 'IT'],
    ['GOA', 'Genova', 'Cristoforo Colombo', 'IT'],
    ['REG', 'Reggio Calabria', 'Tito Minniti', 'IT'],
    ['CRV', 'Crotone', 'S. Anna', 'IT'],
    ['BDS', 'Brindisi', 'Casale', 'IT'],
    ['LCC', 'Lecce', 'Lepore', 'IT'],
    ['SUF', 'Lamezia Terme', 'Lamezia Terme', 'IT'],
    ['AHO', 'Alghero', 'Riviera del Corallo', 'IT'],
    ['OLB', 'Olbia', 'Costa Smeralda', 'IT'],
    ['LHR', 'Londra', 'Heathrow', 'GB'],
    ['LGW', 'Londra', 'Gatwick', 'GB'],
    ['STN', 'Londra', 'Stansted', 'GB'],
    ['LTN', 'Londra', 'Luton', 'GB'],
    ['LCY', 'Londra', 'City', 'GB'],
    ['CDG', 'Parigi', 'Charles de Gaulle', 'FR'],
    ['ORY', 'Parigi', 'Orly', 'FR'],
    ['AMS', 'Amsterdam', 'Schiphol', 'NL'],
    ['FRA', 'Francoforte', 'Frankfurt am Main', 'DE'],
    ['MUC', 'Monaco', 'Franz Josef Strauss', 'DE'],
    ['TXL', 'Berlino', 'Tegel (storico)', 'DE'],
    ['BER', 'Berlino', 'Brandenburg', 'DE'],
    ['HAM', 'Amburgo', 'Hamburg', 'DE'],
    ['DUS', 'Düsseldorf', 'Düsseldorf', 'DE'],
    ['MAD', 'Madrid', 'Adolfo Suárez Barajas', 'ES'],
    ['BCN', 'Barcellona', 'El Prat', 'ES'],
    ['AGP', 'Malaga', 'Costa del Sol', 'ES'],
    ['PMI', 'Palma di Maiorca', 'Son Sant Joan', 'ES'],
    ['VLC', 'Valencia', 'Valencia', 'ES'],
    ['SVQ', 'Siviglia', 'San Pablo', 'ES'],
    ['LIS', 'Lisbona', 'Humberto Delgado', 'PT'],
    ['OPO', 'Porto', 'Sá Carneiro', 'PT'],
    ['ATH', 'Atene', 'Eleftherios Venizelos', 'GR'],
    ['SKG', 'Salonicco', 'Makedonia', 'GR'],
    ['IST', 'Istanbul', 'Istanbul', 'TR'],
    ['SAW', 'Istanbul', 'Sabiha Gökçen', 'TR'],
    ['VIE', 'Vienna', 'Schwechat', 'AT'],
    ['ZRH', 'Zurigo', 'Zürich Airport', 'CH'],
    ['GVA', 'Ginevra', 'Cointrin', 'CH'],
    ['BRU', 'Bruxelles', 'Zaventem', 'BE'],
    ['CPH', 'Copenaghen', 'Kastrup', 'DK'],
    ['ARN', 'Stoccolma', 'Arlanda', 'SE'],
    ['OSL', 'Oslo', 'Gardermoen', 'NO'],
    ['HEL', 'Helsinki', 'Vantaa', 'FI'],
    ['DUB', 'Dublino', 'Dublin', 'IE'],
    ['WAW', 'Varsavia', 'Chopin', 'PL'],
    ['KRK', 'Cracovia', 'John Paul II', 'PL'],
    ['PRG', 'Praga', 'Václav Havel', 'CZ'],
    ['BUD', 'Budapest', 'Liszt Ferenc', 'HU'],
    ['OTP', 'Bucarest', 'Henri Coandă', 'RO'],
    ['SOF', 'Sofia', 'Sofia Airport', 'BG'],
    ['BEG', 'Belgrado', 'Nikola Tesla', 'RS'],
    ['ZAG', 'Zagabria', 'Franjo Tuđman', 'HR'],
    ['LJU', 'Lubiana', 'Jože Pučnik', 'SI'],
    ['TBS', 'Tbilisi', 'Shota Rustaveli', 'GE'],
    ['GYD', 'Baku', 'Heydar Aliyev', 'AZ'],
    ['EVN', 'Yerevan', 'Zvartnots', 'AM'],
    ['JFK', 'New York', 'John F. Kennedy', 'US'],
    ['LGA', 'New York', 'LaGuardia', 'US'],
    ['EWR', 'New York', 'Newark', 'US'],
    ['LAX', 'Los Angeles', 'Los Angeles Intl', 'US'],
    ['ORD', 'Chicago', "O'Hare", 'US'],
    ['MDW', 'Chicago', 'Midway', 'US'],
    ['ATL', 'Atlanta', 'Hartsfield-Jackson', 'US'],
    ['MIA', 'Miami', 'Miami Intl', 'US'],
    ['SFO', 'San Francisco', 'San Francisco Intl', 'US'],
    ['BOS', 'Boston', 'Logan', 'US'],
    ['SEA', 'Seattle', 'Sea-Tac', 'US'],
    ['DFW', 'Dallas', 'Dallas/Fort Worth', 'US'],
    ['DEN', 'Denver', 'Denver Intl', 'US'],
    ['LAS', 'Las Vegas', 'Harry Reid', 'US'],
    ['PHX', 'Phoenix', 'Sky Harbor', 'US'],
    ['MCO', 'Orlando', 'Orlando Intl', 'US'],
    ['MSP', 'Minneapolis', 'Minneapolis–Saint Paul', 'US'],
    ['DTW', 'Detroit', 'Detroit Metropolitan', 'US'],
    ['IAD', 'Washington', 'Dulles', 'US'],
    ['DCA', 'Washington', 'Reagan', 'US'],
    ['BWI', 'Baltimora', 'BWI', 'US'],
    ['IAH', 'Houston', 'George Bush', 'US'],
    ['HOU', 'Houston', 'Hobby', 'US'],
    ['BNA', 'Nashville', 'Nashville Intl', 'US'],
    ['PHL', 'Philadelphia', 'Philadelphia Intl', 'US'],
    ['YYZ', 'Toronto', 'Pearson', 'CA'],
    ['YUL', 'Montreal', 'Trudeau', 'CA'],
    ['YVR', 'Vancouver', 'Vancouver Intl', 'CA'],
    ['YYC', 'Calgary', 'Calgary Intl', 'CA'],
    ['MEX', 'Città del Messico', 'Benito Juárez', 'MX'],
    ['CUN', 'Cancún', 'Cancún Intl', 'MX'],
    ['GRU', 'San Paolo', 'Guarulhos', 'BR'],
    ['GIG', 'Rio de Janeiro', 'Galeão', 'BR'],
    ['SDU', 'Rio de Janeiro', 'Santos Dumont', 'BR'],
    ['BSB', 'Brasilia', 'Presidente Juscelino Kubitschek', 'BR'],
    ['SSA', 'Salvador', 'Deputado Luís Eduardo Magalhães', 'BR'],
    ['FOR', 'Fortaleza', 'Pinto Martins', 'BR'],
    ['REC', 'Recife', 'Guararapes', 'BR'],
    ['MAO', 'Manaus', 'Eduardo Gomes', 'BR'],
    ['SCL', 'Santiago', 'Arturo Merino Benítez', 'CL'],
    ['EZE', 'Buenos Aires', 'Ezeiza', 'AR'],
    ['AEP', 'Buenos Aires', 'Aeroparque Jorge Newbery', 'AR'],
    ['LIM', 'Lima', 'Jorge Chávez', 'PE'],
    ['BOG', 'Bogotá', 'El Dorado', 'CO'],
    ['UIO', 'Quito', 'Mariscal Sucre', 'EC'],
    ['GYE', 'Guayaquil', 'José Joaquín de Olmedo', 'EC'],
    ['MVD', 'Montevideo', 'Carrasco', 'UY'],
    ['ASU', 'Asunción', 'Silvio Pettirossi', 'PY'],
    ['VVI', 'Santa Cruz', 'Viru Viru', 'BO'],
    ['DXB', 'Dubai', 'Dubai Intl', 'AE'],
    ['AUH', 'Abu Dhabi', 'Zayed', 'AE'],
    ['DOH', 'Doha', 'Hamad', 'QA'],
    ['RUH', 'Riad', 'King Khalid', 'SA'],
    ['JED', 'Jeddah', 'King Abdulaziz', 'SA'],
    ['KWI', 'Kuwait City', 'Kuwait', 'KW'],
    ['BAH', 'Manama', 'Bahrain', 'BH'],
    ['MCT', 'Mascate', 'Muscat', 'OM'],
    ['BOM', 'Mumbai', 'Chhatrapati Shivaji', 'IN'],
    ['DEL', 'New Delhi', 'Indira Gandhi', 'IN'],
    ['BLR', 'Bengaluru', 'Kempegowda', 'IN'],
    ['MAA', 'Chennai', 'Chennai Intl', 'IN'],
    ['CCU', 'Calcutta', 'Netaji Subhas Chandra Bose', 'IN'],
    ['HYD', 'Hyderabad', 'Rajiv Gandhi', 'IN'],
    ['AMD', 'Ahmedabad', 'Sardar Vallabhbhai Patel', 'IN'],
    ['COK', 'Kochi', 'Cochin', 'IN'],
    ['SIN', 'Singapore', 'Changi', 'SG'],
    ['KUL', 'Kuala Lumpur', 'KLIA', 'MY'],
    ['BKK', 'Bangkok', 'Suvarnabhumi', 'TH'],
    ['DMK', 'Bangkok', 'Don Mueang', 'TH'],
    ['HKT', 'Phuket', 'Phuket', 'TH'],
    ['CNX', 'Chiang Mai', 'Chiang Mai', 'TH'],
    ['CGK', 'Giacarta', 'Soekarno-Hatta', 'ID'],
    ['DPS', 'Bali/Denpasar', 'Ngurah Rai', 'ID'],
    ['SUB', 'Surabaya', 'Juanda', 'ID'],
    ['MNL', 'Manila', 'Ninoy Aquino', 'PH'],
    ['CEB', 'Cebu', 'Mactan-Cebu', 'PH'],
    ['SGN', 'Ho Chi Minh City', 'Tan Son Nhat', 'VN'],
    ['HAN', 'Hanoi', 'Noi Bai', 'VN'],
    ['DAD', 'Da Nang', 'Da Nang', 'VN'],
    ['PNH', 'Phnom Penh', 'Phnom Penh', 'KH'],
    ['REP', 'Siem Reap', 'Siem Reap', 'KH'],
    ['RGN', 'Yangon', 'Mingaladon', 'MM'],
    ['KTM', 'Kathmandu', 'Tribhuvan', 'NP'],
    ['CMB', 'Colombo', 'Bandaranaike', 'LK'],
    ['HND', 'Tokyo', 'Haneda', 'JP'],
    ['NRT', 'Tokyo', 'Narita', 'JP'],
    ['KIX', 'Osaka', 'Kansai', 'JP'],
    ['NGO', 'Nagoya', 'Chubu Centrair', 'JP'],
    ['FUK', 'Fukuoka', 'Fukuoka', 'JP'],
    ['CTS', 'Sapporo', 'New Chitose', 'JP'],
    ['OKA', 'Okinawa', 'Naha', 'JP'],
    ['ICN', 'Seoul', 'Incheon', 'KR'],
    ['GMP', 'Seoul', 'Gimpo', 'KR'],
    ['PEK', 'Pechino', 'Capital', 'CN'],
    ['PKX', 'Pechino', 'Daxing', 'CN'],
    ['PVG', 'Shanghai', 'Pudong', 'CN'],
    ['SHA', 'Shanghai', 'Hongqiao', 'CN'],
    ['CAN', 'Guangzhou', 'Baiyun', 'CN'],
    ['CTU', 'Chengdu', 'Shuangliu', 'CN'],
    ['SZX', 'Shenzhen', 'Bao\'an', 'CN'],
    ['HKG', 'Hong Kong', 'Hong Kong Intl', 'HK'],
    ['TPE', 'Taipei', 'Taoyuan', 'TW'],
    ['TSA', 'Taipei', 'Songshan', 'TW'],
    ['SYD', 'Sydney', 'Kingsford Smith', 'AU'],
    ['MEL', 'Melbourne', 'Tullamarine', 'AU'],
    ['BNE', 'Brisbane', 'Brisbane Airport', 'AU'],
    ['PER', 'Perth', 'Perth Airport', 'AU'],
    ['ADL', 'Adelaide', 'Adelaide Airport', 'AU'],
    ['AKL', 'Auckland', 'Auckland Intl', 'NZ'],
    ['WLG', 'Wellington', 'Wellington Intl', 'NZ'],
    ['CHC', 'Christchurch', 'Christchurch Intl', 'NZ'],
    ['CAI', 'Il Cairo', 'Cairo Intl', 'EG'],
    ['HRG', 'Hurghada', 'Hurghada', 'EG'],
    ['SSH', 'Sharm el-Sheikh', 'Sharm el-Sheikh', 'EG'],
    ['CMN', 'Casablanca', 'Mohammed V', 'MA'],
    ['RAK', 'Marrakech', 'Menara', 'MA'],
    ['NBO', 'Nairobi', 'Jomo Kenyatta', 'KE'],
    ['MBA', 'Mombasa', 'Moi', 'KE'],
    ['DAR', 'Dar es Salaam', 'Julius Nyerere', 'TZ'],
    ['JNB', 'Johannesburg', 'O.R. Tambo', 'ZA'],
    ['CPT', 'Città del Capo', 'Cape Town', 'ZA'],
    ['DUR', 'Durban', 'King Shaka', 'ZA'],
    ['ACC', 'Accra', 'Kotoka', 'GH'],
    ['LOS', 'Lagos', 'Murtala Muhammed', 'NG'],
    ['ABV', 'Abuja', 'Nnamdi Azikiwe', 'NG'],
    ['ADD', 'Addis Abeba', 'Bole', 'ET'],
    ['KGL', 'Kigali', 'Kigali', 'RW'],
    ['EBB', 'Kampala', 'Entebbe', 'UG'],
    ['BOJ', 'Burgas', 'Burgas', 'BG'],
    ['VAR', 'Varna', 'Varna', 'BG'],
    ['RHO', 'Rodi', 'Diagoras', 'GR'],
    ['CFU', 'Corfù', 'Ioannis Kapodistrias', 'GR'],
    ['HER', 'Creta/Heraklion', 'Nikos Kazantzakis', 'GR'],
    ['CHQ', 'Creta/Chania', 'Daskalogiannis', 'GR'],
    ['ZTH', 'Zante', 'Zakynthos', 'GR'],
    ['KGS', 'Kos', 'Hippocrates', 'GR'],
    ['JMK', 'Mykonos', 'Mykonos', 'GR'],
    ['JTR', 'Santorini', 'Thira', 'GR'],
    ['IBZ', 'Ibiza', 'Ibiza', 'ES'],
    ['ACE', 'Lanzarote', 'Arrecife', 'ES'],
    ['TFS', 'Tenerife Sud', 'Tenerife Sur', 'ES'],
    ['TFN', 'Tenerife Nord', 'Los Rodeos', 'ES'],
    ['LPA', 'Gran Canaria', 'Gran Canaria', 'ES'],
    ['FUE', 'Fuerteventura', 'Fuerteventura', 'ES'],
    ['MLN', 'Melilla', 'Melilla', 'ES'],
    ['RVN', 'Rovaniemi', 'Rovaniemi', 'FI'],
    ['KEM', 'Kemi-Tornio', 'Kemi-Tornio', 'FI'],
    ['IVL', 'Ivalo', 'Ivalo', 'FI'],
    ['KEF', 'Reykjavik', 'Keflavik', 'IS'],
    ['BGO', 'Bergen', 'Flesland', 'NO'],
    ['SVG', 'Stavanger', 'Sola', 'NO'],
    ['TRD', 'Trondheim', 'Trondheim', 'NO'],
    ['LYS', 'Lione', 'Saint-Exupéry', 'FR'],
    ['NCE', 'Nizza', 'Côte d\'Azur', 'FR'],
    ['MRS', 'Marsiglia', 'Provence', 'FR'],
    ['TLS', 'Tolosa', 'Blagnac', 'FR'],
    ['BOD', 'Bordeaux', 'Mérignac', 'FR'],
    ['NTE', 'Nantes', 'Atlantique', 'FR'],
    ['SXB', 'Strasburgo', 'Strasbourg Airport', 'FR'],
    ['BSL', 'Basilea', 'EuroAirport', 'CH'],
    ['BHX', 'Birmingham', 'Birmingham Airport', 'GB'],
    ['MAN', 'Manchester', 'Manchester Airport', 'GB'],
    ['EDI', 'Edimburgo', 'Edinburgh', 'GB'],
    ['GLA', 'Glasgow', 'Glasgow Airport', 'GB'],
    ['BFS', 'Belfast', 'Belfast Intl', 'GB'],
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirportResult {
    iata: string;
    city: string;
    name: string;
    countryCode: string;
    /** Human-friendly label shown in the input after selection */
    label: string;
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
        .map(([iata, city, name, countryCode]) => ({
            iata,
            city,
            name,
            countryCode,
            label: `${iata} — ${city}`,
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
