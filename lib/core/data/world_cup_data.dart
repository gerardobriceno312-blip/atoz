class Team {
  final String name;
  final String flagUrl;
  final String code;

  Team({required this.name, required this.flagUrl, required this.code});
}

class Match {
  final String id;
  final Team teamA;
  final Team teamB;
  final DateTime date;
  final String? group;
  final String? venue;
  final String? city;

  Match({
    required this.id,
    required this.teamA,
    required this.teamB,
    required this.date,
    this.group,
    this.venue,
    this.city,
  });

  bool get isEtapa1 => group != null && group!.length == 1;
  bool get isEtapa2 => group != null && group! == '16avos';
  bool get isEtapa3 => group != null && group! == '8vos';
  bool get isEtapa4 => group != null && group! == '4tos';
  bool get isSemis => group != null && group! == 'Semis';
  bool get isTercerLugar => group != null && group! == '3er Lugar';
  bool get isFinal => group != null && group! == 'Final';
}

class WorldCup2026Data {
  static final Map<String, Team> _teams = {
    'Alemania': Team(
      name: 'Alemania',
      code: 'GER',
      flagUrl: 'https://flagcdn.com/de.svg',
    ),
    'Arabia Saudita': Team(
      name: 'Arabia Saudita',
      code: 'KSA',
      flagUrl: 'https://flagcdn.com/sa.svg',
    ),
    'Argelia': Team(
      name: 'Argelia',
      code: 'ALG',
      flagUrl: 'https://flagcdn.com/dz.svg',
    ),
    'Argentina': Team(
      name: 'Argentina',
      code: 'ARG',
      flagUrl: 'https://flagcdn.com/ar.svg',
    ),
    'Australia': Team(
      name: 'Australia',
      code: 'AUS',
      flagUrl: 'https://flagcdn.com/au.svg',
    ),
    'Austria': Team(
      name: 'Austria',
      code: 'AUT',
      flagUrl: 'https://flagcdn.com/at.svg',
    ),
    'Bélgica': Team(
      name: 'Bélgica',
      code: 'BEL',
      flagUrl: 'https://flagcdn.com/be.svg',
    ),
    'Bosnia y Herzegovina': Team(
      name: 'Bosnia y Herzegovina',
      code: 'BIH',
      flagUrl: 'https://flagcdn.com/ba.svg',
    ),
    'Brasil': Team(
      name: 'Brasil',
      code: 'BRA',
      flagUrl: 'https://flagcdn.com/br.svg',
    ),
    'Cabo Verde': Team(
      name: 'Cabo Verde',
      code: 'CPV',
      flagUrl: 'https://flagcdn.com/cv.svg',
    ),
    'Canadá': Team(
      name: 'Canadá',
      code: 'CAN',
      flagUrl: 'https://flagcdn.com/ca.svg',
    ),
    'Catar': Team(
      name: 'Catar',
      code: 'QAT',
      flagUrl: 'https://flagcdn.com/qa.svg',
    ),
    'Colombia': Team(
      name: 'Colombia',
      code: 'COL',
      flagUrl: 'https://flagcdn.com/co.svg',
    ),
    'Corea del Sur': Team(
      name: 'Corea del Sur',
      code: 'KOR',
      flagUrl: 'https://flagcdn.com/kr.svg',
    ),
    'Costa de Marfil': Team(
      name: 'Costa de Marfil',
      code: 'CIV',
      flagUrl: 'https://flagcdn.com/ci.svg',
    ),
    'Croacia': Team(
      name: 'Croacia',
      code: 'CRO',
      flagUrl: 'https://flagcdn.com/hr.svg',
    ),
    'Curazao': Team(
      name: 'Curazao',
      code: 'CUW',
      flagUrl: 'https://flagcdn.com/cw.svg',
    ),
    'Ecuador': Team(
      name: 'Ecuador',
      code: 'ECU',
      flagUrl: 'https://flagcdn.com/ec.svg',
    ),
    'Egipto': Team(
      name: 'Egipto',
      code: 'EGY',
      flagUrl: 'https://flagcdn.com/eg.svg',
    ),
    'Escocia': Team(
      name: 'Escocia',
      code: 'SCO',
      flagUrl: 'https://flagcdn.com/gb-sct.svg',
    ),
    'España': Team(
      name: 'España',
      code: 'ESP',
      flagUrl: 'https://flagcdn.com/es.svg',
    ),
    'Estados Unidos': Team(
      name: 'Estados Unidos',
      code: 'USA',
      flagUrl: 'https://flagcdn.com/us.svg',
    ),
    'Francia': Team(
      name: 'Francia',
      code: 'FRA',
      flagUrl: 'https://flagcdn.com/fr.svg',
    ),
    'Ghana': Team(
      name: 'Ghana',
      code: 'GHA',
      flagUrl: 'https://flagcdn.com/gh.svg',
    ),
    'Haití': Team(
      name: 'Haití',
      code: 'HAI',
      flagUrl: 'https://flagcdn.com/ht.svg',
    ),
    'Inglaterra': Team(
      name: 'Inglaterra',
      code: 'ENG',
      flagUrl: 'https://flagcdn.com/gb-eng.svg',
    ),
    'Irak': Team(
      name: 'Irak',
      code: 'IRQ',
      flagUrl: 'https://flagcdn.com/iq.svg',
    ),
    'Irán': Team(
      name: 'Irán',
      code: 'IRN',
      flagUrl: 'https://flagcdn.com/ir.svg',
    ),
    'Japón': Team(
      name: 'Japón',
      code: 'JPN',
      flagUrl: 'https://flagcdn.com/jp.svg',
    ),
    'Jordania': Team(
      name: 'Jordania',
      code: 'JOR',
      flagUrl: 'https://flagcdn.com/jo.svg',
    ),
    'Marruecos': Team(
      name: 'Marruecos',
      code: 'MAR',
      flagUrl: 'https://flagcdn.com/ma.svg',
    ),
    'México': Team(
      name: 'México',
      code: 'MEX',
      flagUrl: 'https://flagcdn.com/mx.svg',
    ),
    'Noruega': Team(
      name: 'Noruega',
      code: 'NOR',
      flagUrl: 'https://flagcdn.com/no.svg',
    ),
    'Nueva Zelanda': Team(
      name: 'Nueva Zelanda',
      code: 'NZL',
      flagUrl: 'https://flagcdn.com/nz.svg',
    ),
    'Países Bajos': Team(
      name: 'Países Bajos',
      code: 'NED',
      flagUrl: 'https://flagcdn.com/nl.svg',
    ),
    'Panamá': Team(
      name: 'Panamá',
      code: 'PAN',
      flagUrl: 'https://flagcdn.com/pa.svg',
    ),
    'Paraguay': Team(
      name: 'Paraguay',
      code: 'PAR',
      flagUrl: 'https://flagcdn.com/py.svg',
    ),
    'Portugal': Team(
      name: 'Portugal',
      code: 'POR',
      flagUrl: 'https://flagcdn.com/pt.svg',
    ),
    'RD Congo': Team(
      name: 'RD Congo',
      code: 'COD',
      flagUrl: 'https://flagcdn.com/cd.svg',
    ),
    'República Checa': Team(
      name: 'República Checa',
      code: 'CZE',
      flagUrl: 'https://flagcdn.com/cz.svg',
    ),
    'Senegal': Team(
      name: 'Senegal',
      code: 'SEN',
      flagUrl: 'https://flagcdn.com/sn.svg',
    ),
    'Sudáfrica': Team(
      name: 'Sudáfrica',
      code: 'RSA',
      flagUrl: 'https://flagcdn.com/za.svg',
    ),
    'Suecia': Team(
      name: 'Suecia',
      code: 'SWE',
      flagUrl: 'https://flagcdn.com/se.svg',
    ),
    'Suiza': Team(
      name: 'Suiza',
      code: 'SUI',
      flagUrl: 'https://flagcdn.com/ch.svg',
    ),
    'Túnez': Team(
      name: 'Túnez',
      code: 'TUN',
      flagUrl: 'https://flagcdn.com/tn.svg',
    ),
    'Turquía': Team(
      name: 'Turquía',
      code: 'TUR',
      flagUrl: 'https://flagcdn.com/tr.svg',
    ),
    'Uruguay': Team(
      name: 'Uruguay',
      code: 'URU',
      flagUrl: 'https://flagcdn.com/uy.svg',
    ),
    'Uzbekistán': Team(
      name: 'Uzbekistán',
      code: 'UZB',
      flagUrl: 'https://flagcdn.com/uz.svg',
    ),
  };

  static Team _team(String name) => _teams[name]!;

  static Match _match(
    String id,
    String group,
    String teamA,
    String teamB,
    DateTime date,
    String venue,
  ) {
    return Match(
      id: id,
      group: group,
      teamA: _team(teamA),
      teamB: _team(teamB),
      date: date,
      venue: venue,
    );
  }

  static final List<Match> matches = [
    _match(
      'm1',
      'A',
      'México',
      'Sudáfrica',
      DateTime(2026, 6, 11, 15),
      'Estadio Ciudad de México',
    ),
    _match(
      'm2',
      'A',
      'Corea del Sur',
      'República Checa',
      DateTime(2026, 6, 11, 22),
      'Estadio Guadalajara',
    ),
    _match(
      'm3',
      'A',
      'República Checa',
      'Sudáfrica',
      DateTime(2026, 6, 18, 12),
      'Atlanta Stadium',
    ),
    _match(
      'm4',
      'A',
      'México',
      'Corea del Sur',
      DateTime(2026, 6, 18, 21),
      'Estadio Guadalajara',
    ),
    _match(
      'm5',
      'A',
      'República Checa',
      'México',
      DateTime(2026, 6, 24, 21),
      'Estadio Ciudad de México',
    ),
    _match(
      'm6',
      'A',
      'Sudáfrica',
      'Corea del Sur',
      DateTime(2026, 6, 24, 21),
      'Estadio Monterrey',
    ),
    _match(
      'm7',
      'B',
      'Canadá',
      'Bosnia y Herzegovina',
      DateTime(2026, 6, 12, 15),
      'Toronto Stadium',
    ),
    _match(
      'm8',
      'B',
      'Catar',
      'Suiza',
      DateTime(2026, 6, 13, 15),
      'San Francisco Bay Area Stadium',
    ),
    _match(
      'm9',
      'B',
      'Suiza',
      'Bosnia y Herzegovina',
      DateTime(2026, 6, 18, 15),
      'Los Angeles Stadium',
    ),
    _match(
      'm10',
      'B',
      'Canadá',
      'Catar',
      DateTime(2026, 6, 18, 18),
      'BC Place Vancouver',
    ),
    _match(
      'm11',
      'B',
      'Suiza',
      'Canadá',
      DateTime(2026, 6, 24, 15),
      'BC Place Vancouver',
    ),
    _match(
      'm12',
      'B',
      'Bosnia y Herzegovina',
      'Catar',
      DateTime(2026, 6, 24, 15),
      'Seattle Stadium',
    ),
    _match(
      'm13',
      'C',
      'Brasil',
      'Marruecos',
      DateTime(2026, 6, 13, 18),
      'Nueva York Nueva Jersey Stadium',
    ),
    _match(
      'm14',
      'C',
      'Haití',
      'Escocia',
      DateTime(2026, 6, 13, 21),
      'Boston Stadium',
    ),
    _match(
      'm15',
      'C',
      'Escocia',
      'Marruecos',
      DateTime(2026, 6, 19, 18),
      'Boston Stadium',
    ),
    _match(
      'm16',
      'C',
      'Brasil',
      'Haití',
      DateTime(2026, 6, 19, 21),
      'Philadelphia Stadium',
    ),
    _match(
      'm17',
      'C',
      'Brasil',
      'Escocia',
      DateTime(2026, 6, 24, 18),
      'Miami Stadium',
    ),
    _match(
      'm18',
      'C',
      'Marruecos',
      'Haití',
      DateTime(2026, 6, 24, 18),
      'Atlanta Stadium',
    ),
    _match(
      'm19',
      'D',
      'Estados Unidos',
      'Paraguay',
      DateTime(2026, 6, 12, 21),
      'Los Angeles Stadium',
    ),
    _match(
      'm20',
      'D',
      'Australia',
      'Turquía',
      DateTime(2026, 6, 13),
      'BC Place Vancouver',
    ),
    _match(
      'm21',
      'D',
      'Estados Unidos',
      'Australia',
      DateTime(2026, 6, 19, 15),
      'Seattle Stadium',
    ),
    _match(
      'm22',
      'D',
      'Turquía',
      'Paraguay',
      DateTime(2026, 6, 19),
      'San Francisco Bay Area Stadium',
    ),
    _match(
      'm23',
      'D',
      'Turquía',
      'Estados Unidos',
      DateTime(2026, 6, 25, 22),
      'Los Angeles Stadium',
    ),
    _match(
      'm24',
      'D',
      'Paraguay',
      'Australia',
      DateTime(2026, 6, 25, 22),
      'San Francisco Bay Area Stadium',
    ),
    _match(
      'm25',
      'E',
      'Alemania',
      'Curazao',
      DateTime(2026, 6, 14, 13),
      'Houston Stadium',
    ),
    _match(
      'm26',
      'E',
      'Costa de Marfil',
      'Ecuador',
      DateTime(2026, 6, 14, 19),
      'Philadelphia Stadium',
    ),
    _match(
      'm27',
      'E',
      'Ecuador',
      'Alemania',
      DateTime(2026, 6, 20, 15),
      'Dallas Stadium',
    ),
    _match(
      'm28',
      'E',
      'Curazao',
      'Costa de Marfil',
      DateTime(2026, 6, 20, 21),
      'Houston Stadium',
    ),
    _match(
      'm29',
      'E',
      'Alemania',
      'Costa de Marfil',
      DateTime(2026, 6, 25, 18),
      'Kansas City Stadium',
    ),
    _match(
      'm30',
      'E',
      'Ecuador',
      'Curazao',
      DateTime(2026, 6, 25, 18),
      'Miami Stadium',
    ),
    _match(
      'm31',
      'F',
      'Países Bajos',
      'Japón',
      DateTime(2026, 6, 14, 16),
      'Dallas Stadium',
    ),
    _match(
      'm32',
      'F',
      'Suecia',
      'Túnez',
      DateTime(2026, 6, 14, 22),
      'Monterrey Stadium',
    ),
    _match(
      'm33',
      'F',
      'Japón',
      'Suecia',
      DateTime(2026, 6, 20, 12),
      'Seattle Stadium',
    ),
    _match(
      'm34',
      'F',
      'Países Bajos',
      'Túnez',
      DateTime(2026, 6, 20, 21),
      'Dallas Stadium',
    ),
    _match(
      'm35',
      'F',
      'Países Bajos',
      'Suecia',
      DateTime(2026, 6, 25, 15),
      'Toronto Stadium',
    ),
    _match(
      'm36',
      'F',
      'Japón',
      'Túnez',
      DateTime(2026, 6, 25, 15),
      'Monterrey Stadium',
    ),
    _match(
      'm37',
      'G',
      'Bélgica',
      'Egipto',
      DateTime(2026, 6, 15, 15),
      'Seattle Stadium',
    ),
    _match(
      'm38',
      'G',
      'Irán',
      'Nueva Zelanda',
      DateTime(2026, 6, 15, 21),
      'Los Angeles Stadium',
    ),
    _match(
      'm39',
      'G',
      'Egipto',
      'Irán',
      DateTime(2026, 6, 21, 18),
      'Houston Stadium',
    ),
    _match(
      'm40',
      'G',
      'Bélgica',
      'Nueva Zelanda',
      DateTime(2026, 6, 21, 21),
      'Vancouver Stadium',
    ),
    _match(
      'm41',
      'G',
      'Bélgica',
      'Irán',
      DateTime(2026, 6, 26, 15),
      'Boston Stadium',
    ),
    _match(
      'm42',
      'G',
      'Egipto',
      'Nueva Zelanda',
      DateTime(2026, 6, 26, 15),
      'Dallas Stadium',
    ),
    _match(
      'm43',
      'H',
      'España',
      'Cabo Verde',
      DateTime(2026, 6, 15, 12),
      'Atlanta Stadium',
    ),
    _match(
      'm44',
      'H',
      'Arabia Saudita',
      'Uruguay',
      DateTime(2026, 6, 15, 18),
      'Miami Stadium',
    ),
    _match(
      'm45',
      'H',
      'Uruguay',
      'España',
      DateTime(2026, 6, 21, 15),
      'New York New Jersey Stadium',
    ),
    _match(
      'm46',
      'H',
      'Cabo Verde',
      'Arabia Saudita',
      DateTime(2026, 6, 21, 21),
      'Houston Stadium',
    ),
    _match(
      'm47',
      'H',
      'España',
      'Arabia Saudita',
      DateTime(2026, 6, 26, 18),
      'Philadelphia Stadium',
    ),
    _match(
      'm48',
      'H',
      'Uruguay',
      'Cabo Verde',
      DateTime(2026, 6, 26, 18),
      'Miami Stadium',
    ),
    _match(
      'm49',
      'I',
      'Francia',
      'Senegal',
      DateTime(2026, 6, 16, 15),
      'Los Angeles Stadium',
    ),
    _match(
      'm50',
      'I',
      'Irak',
      'Noruega',
      DateTime(2026, 6, 16, 21),
      'Dallas Stadium',
    ),
    _match(
      'm51',
      'I',
      'Senegal',
      'Irak',
      DateTime(2026, 6, 22, 18),
      'Kansas City Stadium',
    ),
    _match(
      'm52',
      'I',
      'Francia',
      'Noruega',
      DateTime(2026, 6, 22, 21),
      'Seattle Stadium',
    ),
    _match(
      'm53',
      'I',
      'Francia',
      'Irak',
      DateTime(2026, 6, 27, 15),
      'Boston Stadium',
    ),
    _match(
      'm54',
      'I',
      'Senegal',
      'Noruega',
      DateTime(2026, 6, 27, 15),
      'Atlanta Stadium',
    ),
    _match(
      'm55',
      'J',
      'Argentina',
      'Argelia',
      DateTime(2026, 6, 16, 12),
      'Miami Stadium',
    ),
    _match(
      'm56',
      'J',
      'Austria',
      'Jordania',
      DateTime(2026, 6, 16, 19),
      'Monterrey Stadium',
    ),
    _match(
      'm57',
      'J',
      'Argentina',
      'Austria',
      DateTime(2026, 6, 22, 15),
      'Houston Stadium',
    ),
    _match(
      'm58',
      'J',
      'Argelia',
      'Jordania',
      DateTime(2026, 6, 22, 22),
      'Vancouver Stadium',
    ),
    _match(
      'm59',
      'J',
      'Argentina',
      'Jordania',
      DateTime(2026, 6, 27, 18),
      'Los Angeles Stadium',
    ),
    _match(
      'm60',
      'J',
      'Austria',
      'Argelia',
      DateTime(2026, 6, 27, 18),
      'Toronto Stadium',
    ),
    _match(
      'm61',
      'K',
      'Portugal',
      'RD Congo',
      DateTime(2026, 6, 17, 15),
      'Philadelphia Stadium',
    ),
    _match(
      'm62',
      'K',
      'Uzbekistán',
      'Colombia',
      DateTime(2026, 6, 17, 21),
      'Dallas Stadium',
    ),
    _match(
      'm63',
      'K',
      'Colombia',
      'Portugal',
      DateTime(2026, 6, 23, 18),
      'Miami Stadium',
    ),
    _match(
      'm64',
      'K',
      'RD Congo',
      'Uzbekistán',
      DateTime(2026, 6, 23, 21),
      'Kansas City Stadium',
    ),
    _match(
      'm65',
      'K',
      'Portugal',
      'Uzbekistán',
      DateTime(2026, 6, 28, 15),
      'Seattle Stadium',
    ),
    _match(
      'm66',
      'K',
      'Colombia',
      'RD Congo',
      DateTime(2026, 6, 28, 15),
      'Houston Stadium',
    ),
    _match(
      'm67',
      'L',
      'Inglaterra',
      'Croacia',
      DateTime(2026, 6, 17, 12),
      'New York New Jersey Stadium',
    ),
    _match(
      'm68',
      'L',
      'Ghana',
      'Panamá',
      DateTime(2026, 6, 17, 18),
      'Atlanta Stadium',
    ),
    _match(
      'm69',
      'L',
      'Inglaterra',
      'Ghana',
      DateTime(2026, 6, 23, 15),
      'Boston Stadium',
    ),
    _match(
      'm70',
      'L',
      'Croacia',
      'Panamá',
      DateTime(2026, 6, 23, 21),
      'Dallas Stadium',
    ),
    _match(
      'm71',
      'L',
      'Inglaterra',
      'Panamá',
      DateTime(2026, 6, 28, 18),
      'Miami Stadium',
    ),
    _match(
      'm72',
      'L',
      'Croacia',
      'Ghana',
      DateTime(2026, 6, 28, 18),
      'Monterrey Stadium',
    ),
    _match(
      'm73',
      '16avos',
      'Sudáfrica',
      'Canadá',
      DateTime(2026, 6, 28, 15),
      'Los Angeles Stadium',
    ),
    _match(
      'm74',
      '16avos',
      'Alemania',
      'Paraguay',
      DateTime(2026, 6, 29, 15),
      'Boston Stadium',
    ),
    _match(
      'm75',
      '16avos',
      'Países Bajos',
      'Marruecos',
      DateTime(2026, 6, 29, 18),
      'Monterrey Stadium',
    ),
    _match(
      'm76',
      '16avos',
      'Brasil',
      'Japón',
      DateTime(2026, 6, 29, 21),
      'Houston Stadium',
    ),
    _match(
      'm77',
      '16avos',
      'Francia',
      'Suecia',
      DateTime(2026, 6, 30, 15),
      'New York New Jersey Stadium',
    ),
    _match(
      'm78',
      '16avos',
      'Costa de Marfil',
      'Noruega',
      DateTime(2026, 6, 30, 18),
      'Dallas Stadium',
    ),
    _match(
      'm79',
      '16avos',
      'México',
      'Ecuador',
      DateTime(2026, 6, 30, 21),
      'Estadio Ciudad de México',
    ),
    _match(
      'm80',
      '16avos',
      'Inglaterra',
      'RD Congo',
      DateTime(2026, 7, 1, 15),
      'Atlanta Stadium',
    ),
    _match(
      'm81',
      '16avos',
      'Estados Unidos',
      'Bosnia y Herzegovina',
      DateTime(2026, 7, 1, 18),
      'San Francisco Bay Area Stadium',
    ),
    _match(
      'm82',
      '16avos',
      'Bélgica',
      'Senegal',
      DateTime(2026, 7, 1, 21),
      'Seattle Stadium',
    ),
    _match(
      'm83',
      '16avos',
      'Portugal',
      'Croacia',
      DateTime(2026, 7, 2, 15),
      'Toronto Stadium',
    ),
    _match(
      'm84',
      '16avos',
      'España',
      'Austria',
      DateTime(2026, 7, 2, 18),
      'Los Angeles Stadium',
    ),
    _match(
      'm85',
      '16avos',
      'Suiza',
      'Argelia',
      DateTime(2026, 7, 2, 21),
      'Vancouver Stadium',
    ),
    _match(
      'm86',
      '16avos',
      'Argentina',
      'Cabo Verde',
      DateTime(2026, 7, 3, 15),
      'Miami Stadium',
    ),
    _match(
      'm87',
      '16avos',
      'Colombia',
      'Ghana',
      DateTime(2026, 7, 3, 18),
      'Kansas City Stadium',
    ),
    _match(
      'm88',
      '16avos',
      'Australia',
      'Egipto',
      DateTime(2026, 7, 3, 21),
      'Dallas Stadium',
    ),
    _match(
      'm89',
      '8vos',
      'Canadá',
      'Marruecos',
      DateTime(2026, 7, 4, 13),
      'Houston Stadium',
    ),
    _match(
      'm90',
      '8vos',
      'Paraguay',
      'Francia',
      DateTime(2026, 7, 4, 17),
      'Philadelphia Stadium',
    ),
    _match(
      'm91',
      '8vos',
      'Brasil',
      'Noruega',
      DateTime(2026, 7, 5, 16),
      'New York New Jersey Stadium',
    ),
    _match(
      'm92',
      '8vos',
      'México',
      'Inglaterra',
      DateTime(2026, 7, 5, 20),
      'Estadio Ciudad de México',
    ),
    _match(
      'm93',
      '8vos',
      'Estados Unidos',
      'Bélgica',
      DateTime(2026, 7, 6, 15),
      'Dallas Stadium',
    ),
    _match(
      'm94',
      '8vos',
      'Portugal',
      'España',
      DateTime(2026, 7, 6, 20),
      'Seattle Stadium',
    ),
    _match(
      'm95',
      '8vos',
      'Argentina',
      'Egipto',
      DateTime(2026, 7, 7, 12),
      'Atlanta Stadium',
    ),
    _match(
      'm97',
      '4tos',
      'Francia',
      'Marruecos',
      DateTime(2026, 7, 9, 16),
      'Boston Stadium',
    ),
    _match(
      'm98',
      '4tos',
      'España',
      'Bélgica',
      DateTime(2026, 7, 10, 15),
      'Los Angeles Stadium',
    ),
    _match(
      'm99',
      '4tos',
      'Noruega',
      'Inglaterra',
      DateTime(2026, 7, 11, 17),
      'Miami Stadium',
    ),
    _match(
      'm100',
      '4tos',
      'Argentina',
      'Suiza',
      DateTime(2026, 7, 11, 21),
      'Kansas City Stadium',
    ),
    _match(
      'm101',
      'Semis',
      'Francia',
      'España',
      DateTime(2026, 7, 14, 20),
      'Dallas Stadium',
    ),
    _match(
      'm102',
      'Semis',
      'Argentina',
      'Inglaterra',
      DateTime(2026, 7, 15, 20),
      'Atlanta Stadium',
    ),
    _match(
      'm103',
      '3er Lugar',
      'Francia',
      'Inglaterra',
      DateTime(2026, 7, 18, 16),
      'Miami Stadium',
    ),
    _match(
      'm104',
      'Final',
      'España',
      'Argentina',
      DateTime(2026, 7, 19, 16),
      'New York New Jersey Stadium',
    ),
  ];

  static List<Match> get groupStageMatches =>
      matches.where((m) => m.group != null && m.group!.length == 1).toList();

  static List<Match> get knockoutMatches =>
      matches.where((m) => m.group == '16avos').toList();

  static List<Match> get octavosMatches =>
      matches.where((m) => m.group == '8vos').toList();

  static List<Match> get cuartosMatches =>
      matches.where((m) => m.group == '4tos').toList();

  static List<Match> get semifinalMatches =>
      matches.where((m) => m.group == 'Semis').toList();

  static List<Match> get tercerLugarMatches =>
      matches.where((m) => m.group == '3er Lugar').toList();

  static List<Match> get finalMatches =>
      matches.where((m) => m.group == 'Final').toList();

  static List<String> get groups {
    return groupStageMatches
        .map((match) => match.group)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();
  }

  static List<Match> matchesByGroup(String group) {
    return groupStageMatches.where((match) => match.group == group).toList();
  }

  static Match? matchById(String id) {
    for (final match in matches) {
      if (match.id == id) return match;
    }
    return null;
  }
}
