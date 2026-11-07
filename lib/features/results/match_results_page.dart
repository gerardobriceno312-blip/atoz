import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/colors.dart';
import '../../core/data/world_cup_data.dart';
import '../../core/services/supabase_service.dart';
import '../../widgets/futuristic_card.dart';

class MatchResultsPage extends StatefulWidget {
  final bool showAppBar;

  const MatchResultsPage({super.key, this.showAppBar = true});

  @override
  State<MatchResultsPage> createState() => _MatchResultsPageState();
}

class _MatchResultsPageState extends State<MatchResultsPage> {
  late Future<List<Map<String, dynamic>>> _resultsFuture;

  @override
  void initState() {
    super.initState();
    _resultsFuture = SupabaseService.getFinishedMatchResults();
  }

  Future<void> _refreshResults() async {
    setState(() {
      _resultsFuture = SupabaseService.getFinishedMatchResults();
    });
    await _resultsFuture;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.showAppBar
          ? AppBar(
              title: const Text('RESULTADOS'),
              actions: [
                IconButton(
                  tooltip: 'Actualizar resultados',
                  icon: const Icon(Icons.refresh, color: AtozColors.gold),
                  onPressed: _refreshResults,
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
          future: _resultsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final results = snapshot.data ?? [];
            if (results.isEmpty) {
              return RefreshIndicator(
                onRefresh: _refreshResults,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 180),
                    Icon(
                      Icons.scoreboard_outlined,
                      size: 72,
                      color: AtozColors.gold,
                    ),
                    SizedBox(height: 20),
                    Text(
                      'Todavía no hay resultados publicados.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 16),
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: _refreshResults,
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: results.length,
                itemBuilder: (context, index) {
                  return _buildResultCard(results[index]);
                },
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildResultCard(Map<String, dynamic> result) {
    final officialMatch = WorldCup2026Data.matchById(
      (result['official_match_id'] ?? '').toString(),
    );
    final teamA =
        officialMatch?.teamA ??
        Team(
          name: (result['team_a'] ?? 'Equipo A').toString(),
          code: (result['team_a'] ?? 'A').toString(),
          flagUrl: 'https://flagcdn.com/un.svg',
        );
    final teamB =
        officialMatch?.teamB ??
        Team(
          name: (result['team_b'] ?? 'Equipo B').toString(),
          code: (result['team_b'] ?? 'B').toString(),
          flagUrl: 'https://flagcdn.com/un.svg',
        );
    final scoreA = result['score_a']?.toString() ?? '-';
    final scoreB = result['score_b']?.toString() ?? '-';
    final date = DateTime.tryParse((result['date'] ?? '').toString());
    final group = result['group']?.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: FuturisticCard(
        height: 210,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _subtitle(date, group, officialMatch?.venue),
              textAlign: TextAlign.center,
              style: const TextStyle(color: AtozColors.gold, fontSize: 12),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(child: _buildTeam(teamA)),
                SizedBox(
                  width: 120,
                  child: Text(
                    '$scoreA - $scoreB',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AtozColors.gold,
                      fontSize: 34,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Expanded(child: _buildTeam(teamB)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTeam(Team team) {
    return Column(
      children: [
        SvgPicture.network(
          team.flagUrl,
          width: 45,
          placeholderBuilder: (context) => const SizedBox(
            width: 45,
            height: 30,
            child: Center(child: CircularProgressIndicator(strokeWidth: 1)),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          team.code,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  String _subtitle(DateTime? date, String? group, String? venue) {
    final parts = <String>[];
    if (group != null && group.isNotEmpty) parts.add('Grupo $group');
    if (date != null) {
      parts.add(
        '${date.day}/${date.month} ${date.hour}:${date.minute.toString().padLeft(2, '0')}',
      );
    }
    if (venue != null && venue.isNotEmpty) parts.add(venue);
    return parts.join(' - ');
  }
}
