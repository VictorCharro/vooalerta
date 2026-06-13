export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  keywords?: string; // termos alternativos de busca
}

export const AIRPORTS: Airport[] = [
  // ── Brasil ────────────────────────────────────────────────
  { iata: 'GRU', name: 'Guarulhos', city: 'São Paulo', country: 'BR', keywords: 'guarulhos sp sampa' },
  { iata: 'CGH', name: 'Congonhas', city: 'São Paulo', country: 'BR', keywords: 'congonhas sp sampa' },
  { iata: 'VCP', name: 'Viracopos', city: 'Campinas', country: 'BR', keywords: 'viracopos campinas sp' },
  { iata: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country: 'BR', keywords: 'galeão rio rj' },
  { iata: 'SDU', name: 'Santos Dumont', city: 'Rio de Janeiro', country: 'BR', keywords: 'santos dumont rio rj' },
  { iata: 'BSB', name: 'Brasília', city: 'Brasília', country: 'BR', keywords: 'df federal' },
  { iata: 'CNF', name: 'Confins', city: 'Belo Horizonte', country: 'BR', keywords: 'confins bh minas' },
  { iata: 'PLU', name: 'Pampulha', city: 'Belo Horizonte', country: 'BR', keywords: 'pampulha bh minas' },
  { iata: 'SSA', name: 'Deputado Luís Eduardo Magalhães', city: 'Salvador', country: 'BR', keywords: 'salvador bahia ba' },
  { iata: 'REC', name: 'Guararapes', city: 'Recife', country: 'BR', keywords: 'recife pernambuco pe' },
  { iata: 'FOR', name: 'Pinto Martins', city: 'Fortaleza', country: 'BR', keywords: 'fortaleza ceara ce' },
  { iata: 'BEL', name: 'Val-de-Cans', city: 'Belém', country: 'BR', keywords: 'belem para pa' },
  { iata: 'MAN', name: 'Eduardo Gomes', city: 'Manaus', country: 'BR', keywords: 'manaus amazonas am' },
  { iata: 'CWB', name: 'Afonso Pena', city: 'Curitiba', country: 'BR', keywords: 'curitiba parana pr' },
  { iata: 'POA', name: 'Salgado Filho', city: 'Porto Alegre', country: 'BR', keywords: 'porto alegre rs gaúcha' },
  { iata: 'FLN', name: 'Hercílio Luz', city: 'Florianópolis', country: 'BR', keywords: 'florianopolis sc floripa' },
  { iata: 'NAT', name: 'Augusto Severo', city: 'Natal', country: 'BR', keywords: 'natal rn' },
  { iata: 'MCZ', name: 'Zumbi dos Palmares', city: 'Maceió', country: 'BR', keywords: 'maceio alagoas al' },
  { iata: 'JPA', name: 'Castro Pinto', city: 'João Pessoa', country: 'BR', keywords: 'joao pessoa paraiba pb' },
  { iata: 'AJU', name: 'Santa Maria', city: 'Aracaju', country: 'BR', keywords: 'aracaju sergipe se' },
  { iata: 'THE', name: 'Senador Petrônio Portella', city: 'Teresina', country: 'BR', keywords: 'teresina piaui pi' },
  { iata: 'SLZ', name: 'Marechal Cunha Machado', city: 'São Luís', country: 'BR', keywords: 'sao luis maranhao ma' },
  { iata: 'CGR', name: 'Campo Grande', city: 'Campo Grande', country: 'BR', keywords: 'campo grande ms mato grosso' },
  { iata: 'CGB', name: 'Marechal Rondon', city: 'Cuiabá', country: 'BR', keywords: 'cuiaba mato grosso mt' },
  { iata: 'GYN', name: 'Santa Genoveva', city: 'Goiânia', country: 'BR', keywords: 'goiania goias go' },
  { iata: 'MAO', name: 'Eduardo Gomes', city: 'Manaus', country: 'BR', keywords: 'manaus am' },
  { iata: 'IGU', name: 'Cataratas', city: 'Foz do Iguaçu', country: 'BR', keywords: 'foz iguacu cataratas pr' },
  { iata: 'VIX', name: 'Eurico Salles', city: 'Vitória', country: 'BR', keywords: 'vitoria espirito santo es' },
  { iata: 'PVH', name: 'Governador Jorge Teixeira', city: 'Porto Velho', country: 'BR', keywords: 'porto velho rondonia ro' },
  { iata: 'PMW', name: 'Brigadeiro Lysias Rodrigues', city: 'Palmas', country: 'BR', keywords: 'palmas tocantins to' },

  // ── América do Sul ────────────────────────────────────────
  { iata: 'EZE', name: 'Ministro Pistarini', city: 'Buenos Aires', country: 'AR', keywords: 'ezeiza buenos aires argentina' },
  { iata: 'AEP', name: 'Jorge Newbery', city: 'Buenos Aires', country: 'AR', keywords: 'aeroparque buenos aires argentina' },
  { iata: 'LIM', name: 'Jorge Chávez', city: 'Lima', country: 'PE', keywords: 'lima peru' },
  { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', country: 'CO', keywords: 'bogota colombia' },
  { iata: 'SCL', name: 'Arturo Merino Benítez', city: 'Santiago', country: 'CL', keywords: 'santiago chile' },
  { iata: 'MVD', name: 'Carrasco', city: 'Montevidéu', country: 'UY', keywords: 'montevideo uruguai' },
  { iata: 'ASU', name: 'Silvio Pettirossi', city: 'Assunção', country: 'PY', keywords: 'assuncao paraguai' },
  { iata: 'UIO', name: 'Mariscal Sucre', city: 'Quito', country: 'EC', keywords: 'quito equador' },
  { iata: 'GYE', name: 'José Joaquín de Olmedo', city: 'Guayaquil', country: 'EC', keywords: 'guayaquil equador' },
  { iata: 'CCS', name: 'Simón Bolívar', city: 'Caracas', country: 'VE', keywords: 'caracas venezuela' },

  // ── América do Norte ──────────────────────────────────────
  { iata: 'JFK', name: 'John F. Kennedy', city: 'Nova York', country: 'US', keywords: 'new york eua estados unidos' },
  { iata: 'EWR', name: 'Newark Liberty', city: 'Nova York', country: 'US', keywords: 'newark new york eua' },
  { iata: 'LGA', name: 'LaGuardia', city: 'Nova York', country: 'US', keywords: 'laguardia new york eua' },
  { iata: 'MIA', name: 'Miami', city: 'Miami', country: 'US', keywords: 'miami florida eua' },
  { iata: 'MCO', name: 'Orlando', city: 'Orlando', country: 'US', keywords: 'orlando florida disney eua' },
  { iata: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'US', keywords: 'los angeles california eua' },
  { iata: 'ORD', name: "O'Hare", city: 'Chicago', country: 'US', keywords: 'chicago illinois eua' },
  { iata: 'IAH', name: 'George Bush', city: 'Houston', country: 'US', keywords: 'houston texas eua' },
  { iata: 'BOS', name: 'Logan', city: 'Boston', country: 'US', keywords: 'boston eua' },
  { iata: 'YYZ', name: 'Pearson', city: 'Toronto', country: 'CA', keywords: 'toronto canada' },
  { iata: 'YUL', name: 'Trudeau', city: 'Montreal', country: 'CA', keywords: 'montreal canada' },
  { iata: 'MEX', name: 'Benito Juárez', city: 'Cidade do México', country: 'MX', keywords: 'mexico cidade df' },
  { iata: 'CUN', name: 'Cancún', city: 'Cancún', country: 'MX', keywords: 'cancun mexico caribe' },

  // ── Europa ────────────────────────────────────────────────
  { iata: 'LIS', name: 'Humberto Delgado', city: 'Lisboa', country: 'PT', keywords: 'lisboa portugal' },
  { iata: 'OPO', name: 'Francisco Sá Carneiro', city: 'Porto', country: 'PT', keywords: 'porto portugal' },
  { iata: 'MAD', name: 'Barajas', city: 'Madri', country: 'ES', keywords: 'madrid espanha' },
  { iata: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'ES', keywords: 'barcelona espanha' },
  { iata: 'LHR', name: 'Heathrow', city: 'Londres', country: 'GB', keywords: 'london heathrow inglaterra' },
  { iata: 'LGW', name: 'Gatwick', city: 'Londres', country: 'GB', keywords: 'london gatwick inglaterra' },
  { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'FR', keywords: 'paris franca' },
  { iata: 'ORY', name: 'Orly', city: 'Paris', country: 'FR', keywords: 'paris orly franca' },
  { iata: 'FCO', name: 'Fiumicino', city: 'Roma', country: 'IT', keywords: 'roma italia' },
  { iata: 'MXP', name: 'Malpensa', city: 'Milão', country: 'IT', keywords: 'milao italia' },
  { iata: 'AMS', name: 'Schiphol', city: 'Amsterdã', country: 'NL', keywords: 'amsterdam holanda' },
  { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'DE', keywords: 'frankfurt alemanha' },
  { iata: 'MUC', name: 'Munich', city: 'Munique', country: 'DE', keywords: 'munique alemanha' },
  { iata: 'ZRH', name: 'Zurique', city: 'Zurique', country: 'CH', keywords: 'zurich suica' },
  { iata: 'DUB', name: 'Dublin', city: 'Dublin', country: 'IE', keywords: 'dublin irlanda' },
  { iata: 'VIE', name: 'Schwechat', city: 'Viena', country: 'AT', keywords: 'viena austria' },
  { iata: 'ATH', name: 'Eleftherios Venizelos', city: 'Atenas', country: 'GR', keywords: 'atenas grecia' },

  // ── Caribe e destinos de férias ───────────────────────────
  { iata: 'PUJ', name: 'Punta Cana', city: 'Punta Cana', country: 'DO', keywords: 'punta cana republica dominicana caribe' },
  { iata: 'MBJ', name: 'Sangster', city: 'Montego Bay', country: 'JM', keywords: 'montego bay jamaica caribe' },
  { iata: 'NAS', name: 'Lynden Pindling', city: 'Nassau', country: 'BS', keywords: 'nassau bahamas caribe' },
  { iata: 'HAV', name: 'José Martí', city: 'Havana', country: 'CU', keywords: 'havana cuba caribe' },

  // ── África e Oriente Médio ────────────────────────────────
  { iata: 'DXB', name: 'Dubai', city: 'Dubai', country: 'AE', keywords: 'dubai emirados arabes' },
  { iata: 'DOH', name: 'Hamad', city: 'Doha', country: 'QA', keywords: 'doha qatar' },
  { iata: 'CPT', name: 'Cape Town', city: 'Cidade do Cabo', country: 'ZA', keywords: 'cidade do cabo africa do sul' },
  { iata: 'JNB', name: 'O.R. Tambo', city: 'Joanesburgo', country: 'ZA', keywords: 'johannesburg africa do sul' },
  { iata: 'MRU', name: 'Sir Seewoosagur Ramgoolam', city: 'Maurício', country: 'MU', keywords: 'mauricio ilha' },

  // ── Ásia e Oceania ────────────────────────────────────────
  { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'TH', keywords: 'bangkok tailandia' },
  { iata: 'NRT', name: 'Narita', city: 'Tóquio', country: 'JP', keywords: 'tokyo toquio japao' },
  { iata: 'HND', name: 'Haneda', city: 'Tóquio', country: 'JP', keywords: 'tokyo toquio haneda japao' },
  { iata: 'SIN', name: 'Changi', city: 'Singapura', country: 'SG', keywords: 'singapore singapura' },
  { iata: 'SYD', name: 'Kingsford Smith', city: 'Sydney', country: 'AU', keywords: 'sydney australia' },
];

export function searchAirports(query: string): Airport[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return AIRPORTS.filter(a => {
    const haystack = `${a.iata} ${a.city} ${a.name} ${a.country} ${a.keywords ?? ''}`
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return haystack.includes(q);
  }).slice(0, 6);
}
