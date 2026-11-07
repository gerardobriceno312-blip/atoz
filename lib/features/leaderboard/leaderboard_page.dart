import 'package:flutter/material.dart';
import '../../core/colors.dart';
import '../../widgets/futuristic_card.dart';
import '../../core/services/supabase_service.dart';

class LeaderboardPage extends StatefulWidget {
  final bool showAppBar;

  const LeaderboardPage({super.key, this.showAppBar = true});

  @override
  State<LeaderboardPage> createState() => _LeaderboardPageState();
}

class _LeaderboardPageState extends State<LeaderboardPage> {
  late Future<List<Map<String, dynamic>>> _leaderboardFuture;

  @override
  void initState() {
    super.initState();
    _leaderboardFuture = SupabaseService.getLeaderboard();
  }

  Future<void> _refreshLeaderboard() async {
    setState(() {
      _leaderboardFuture = SupabaseService.getLeaderboard();
    });
    await _leaderboardFuture;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.showAppBar
          ? AppBar(
              title: const Text('RANKING EN VIVO'),
              actions: [
                IconButton(
                  tooltip: 'Actualizar ranking',
                  icon: const Icon(Icons.refresh, color: AtozColors.gold),
                  onPressed: _refreshLeaderboard,
                ),
              ],
            )
          : null,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AtozColors.background, Color(0xFF1A0504)],
          ),
        ),
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _leaderboardFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (!snapshot.hasData || snapshot.data!.isEmpty) {
              return const Center(child: Text('No hay datos de ranking aún.'));
            }

            final participants = snapshot.data!;
            final firstPlace = participants.isNotEmpty ? participants[0] : null;
            final secondPlace = participants.length > 1 ? participants[1] : null;
            return RefreshIndicator(
              onRefresh: _refreshLeaderboard,
              child: ListView(
                padding: const EdgeInsets.only(top: 24),
                children: [
                  _buildStage1WinnersBanner(firstPlace, secondPlace),
                  const SizedBox(height: 12),
                  _buildPodium(participants[0]),
                  const SizedBox(height: 24),
                  const Text(
                    'TABLA GENERAL',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      letterSpacing: 3,
                      fontSize: 12,
                      color: Colors.white38,
                    ),
                  ),
                  const Divider(
                    color: AtozColors.gold,
                    indent: 50,
                    endIndent: 50,
                  ),
                  for (var index = 1; index < participants.length; index++)
                    _buildRankingItem(index + 1, participants[index]),
                  const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text(
                      'Diseñada por Ing. David Zara',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white24, fontSize: 10),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildStage1WinnersBanner(
    Map<String, dynamic>? first,
    Map<String, dynamic>? second,
  ) {
    if (first == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Container(
        height: 235,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF8A1538), // Qatar burgundy
              Color(0xFFD4AF37), // Shiny Gold
              Color(0xFFE5A93B), // Honey Gold
              Color(0xFF50061A), // Dark wine
            ],
            stops: [0.0, 0.45, 0.55, 1.0],
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFD4AF37).withOpacity(0.35),
              blurRadius: 15,
              spreadRadius: 2,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(
            color: const Color(0xFFD4AF37).withOpacity(0.6),
            width: 2.0,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Container(
            color: Colors.black.withOpacity(0.25), // Overlay for readability
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text('🎉   ', style: TextStyle(fontSize: 20)),
                    Icon(Icons.emoji_events, color: Colors.white, size: 28),
                    SizedBox(width: 8),
                    Text(
                      '¡FELICIDADES CAMPEONES!',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        letterSpacing: 2.0,
                        shadows: [
                          Shadow(
                            color: Colors.black54,
                            offset: Offset(1, 2),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                    ),
                    Text('   🥳', style: TextStyle(fontSize: 20)),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Fin de la Etapa 1: Fase de Grupos',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
                const Divider(color: Colors.white30, height: 16),
                Expanded(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              '🏆 1er Lugar',
                              style: TextStyle(
                                color: Color(0xFFFFE79A),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                shadows: [Shadow(color: Colors.black45, blurRadius: 2)],
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Ernesto Rodriguez',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Colors.white,
                                shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                              ),
                            ),
                            const Text(
                              '171 pts',
                              style: TextStyle(
                                color: Color(0xFFFFE79A),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Premio: ¡Servicio de Ron! 🥃\n(Disfrútalo en nuestro local)',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                height: 1.3,
                                shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const VerticalDivider(color: Colors.white30, width: 20),
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              '🥈 2do Lugar',
                              style: TextStyle(
                                color: Color(0xFFE2E2E2),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                shadows: [Shadow(color: Colors.black45, blurRadius: 2)],
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Henry bello',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Colors.white,
                                shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                              ),
                            ),
                            const Text(
                              '161 pts',
                              style: TextStyle(
                                color: Color(0xFFE2E2E2),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Premio: ¡Tobo de Cerveza Zulia! 🍺\n(Consúmelo en el local)',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                height: 1.3,
                                shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPodium(Map<String, dynamic> top1) {
    return Center(
      child: Column(
        children: [
          Stack(
            alignment: Alignment.bottomRight,
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AtozColors.gold,
                ),
                child: const CircleAvatar(
                  radius: 50,
                  backgroundColor: AtozColors.burgundy,
                  child: Icon(Icons.person, size: 50, color: AtozColors.gold),
                ),
              ),
              const CircleAvatar(
                radius: 18,
                backgroundColor: AtozColors.gold,
                child: Text(
                  '1',
                  style: TextStyle(
                    color: AtozColors.burgundy,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            top1['full_name'] ?? 'Rey de la Quiniela',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          Text(
            '${top1['points']} PUNTOS',
            style: const TextStyle(
              color: AtozColors.gold,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRankingItem(int rank, Map<String, dynamic> user) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: FuturisticCard(
        height: 70,
        child: Row(
          children: [
            Text(
              '#$rank',
              style: const TextStyle(
                color: AtozColors.gold,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            const SizedBox(width: 16),
            const CircleAvatar(
              radius: 15,
              backgroundColor: Colors.white10,
              child: Icon(Icons.person, size: 15, color: Colors.white38),
            ),
            const SizedBox(width: 12),
            Text(
              user['full_name'] ?? 'Jugador',
              style: const TextStyle(fontSize: 16),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: AtozColors.gold.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '${user['points']} pts',
                style: const TextStyle(
                  color: AtozColors.gold,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
