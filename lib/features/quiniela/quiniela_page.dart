import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/colors.dart';
import '../../core/data/world_cup_data.dart';
import '../../widgets/futuristic_card.dart';
import '../../core/services/supabase_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class QuinielaPage extends StatefulWidget {
  final bool isDemo;

  const QuinielaPage({super.key, this.isDemo = false});

  @override
  State<QuinielaPage> createState() => _QuinielaPageState();
}

class _QuinielaPageState extends State<QuinielaPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Store predictions as { matchId: { 'A': score, 'B': score } }
  final Map<String, Map<String, int?>> _predictions = {};
  // Store controllers as { matchId: { 'A': controller, 'B': controller } }
  final Map<String, Map<String, TextEditingController>> _controllers = {};
  final Set<String> _missingFields = {};
  final Set<String> _finishedMatches = {};
  bool _isSaving = false;
  bool _alreadySavedSemis = false;
  bool _alreadySavedFinal = false;
  List<Map<String, dynamic>>? _leaderboard;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
    if (!widget.isDemo) {
      _loadFinishedMatches();
      _checkIfAlreadySaved();
      _loadLeaderboard();
    }
  }

  Future<void> _loadLeaderboard() async {
    try {
      final leaderboard = await SupabaseService.getLeaderboard();
      if (mounted) {
        setState(() {
          _leaderboard = leaderboard;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadFinishedMatches() async {
    try {
      final finishedMatches = await SupabaseService.getFinishedMatchIds();
      if (mounted) {
        setState(() {
          _finishedMatches
            ..clear()
            ..addAll(finishedMatches);
          _alreadySavedSemis = _hasAllOpenPredictionsSemis();
          _alreadySavedFinal = _hasAllOpenPredictionsFinal();
        });
      }
    } catch (_) {
      // If the matches table is not readable yet, keep the local schedule usable.
    }
  }

  Future<void> _checkIfAlreadySaved() async {
    // Check in Supabase if this user has any predictions
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      final res = await Supabase.instance.client
          .from('predictions')
          .select()
          .eq('user_id', user.id);
      if (res.isNotEmpty) {
        setState(() {
          for (var row in res) {
            final matchId = row['match_id'] as String;
            final scoreA = row['score_a'] as int?;
            final scoreB = row['score_b'] as int?;

            _predictions[matchId] = {'A': scoreA, 'B': scoreB};

            // If the controller has already been created (e.g. built in the list), update its text
            if (_controllers.containsKey(matchId)) {
              if (_controllers[matchId]!.containsKey('A') && scoreA != null) {
                _controllers[matchId]!['A']!.text = scoreA.toString();
              }
              if (_controllers[matchId]!.containsKey('B') && scoreB != null) {
                _controllers[matchId]!['B']!.text = scoreB.toString();
              }
            }
          }
          _alreadySavedSemis = _hasAllOpenPredictionsSemis();
          _alreadySavedFinal = _hasAllOpenPredictionsFinal();
        });
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    for (var matchControllers in _controllers.values) {
      for (var controller in matchControllers.values) {
        controller.dispose();
      }
    }
    super.dispose();
  }

  void _updateScore(String matchId, String team, String value) {
    setState(() {
      if (!_predictions.containsKey(matchId)) {
        _predictions[matchId] = {'A': null, 'B': null};
      }
      _predictions[matchId]![team] = int.tryParse(value);
      _missingFields.remove(matchId);
    });
  }

  Future<void> _saveSemis() async {
    if (widget.isDemo) {
      _saveDemo();
      return;
    }
    if (_alreadySavedSemis) return;

    final openSemisMatches = WorldCup2026Data.semifinalMatches
        .where((match) => !_isMatchClosed(match))
        .toList();
    final List<String> incomplete = [];
    for (var match in openSemisMatches) {
      final pred = _predictions[match.id];
      if (pred == null || pred['A'] == null || pred['B'] == null) {
        incomplete.add(match.id);
      }
    }

    if (incomplete.isNotEmpty) {
      setState(() {
        _missingFields.addAll(incomplete);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text(
            'POR FAVOR COMPLETA TODOS LOS PRONÓSTICOS DE LAS SEMIFINALES',
          ),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final semisIds = openSemisMatches.map((m) => m.id).toSet();
      for (var matchId in _predictions.keys) {
        if (!semisIds.contains(matchId)) continue;
        final scores = _predictions[matchId]!;
        await SupabaseService.savePrediction(
          user.id,
          matchId,
          scores['A']!,
          scores['B']!,
        );
      }

      setState(() {
        _alreadySavedSemis = _hasAllOpenPredictionsSemis();
        _isSaving = false;
      });

      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: AtozColors.burgundy,
            title: const Text(
              '¡PRONÓSTICOS GUARDADOS!',
              style: TextStyle(color: AtozColors.gold),
            ),
            content: const Text(
              'Tus resultados de las Semifinales han sido registrados. No podrán ser editados.',
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('ENTENDIDO'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error al guardar: $e')));
      }
    }
  }

  Future<void> _saveFinal() async {
    if (widget.isDemo) {
      _saveDemo();
      return;
    }
    if (_alreadySavedFinal) return;

    final openFinalMatches = [
      ...WorldCup2026Data.tercerLugarMatches,
      ...WorldCup2026Data.finalMatches
    ].where((match) => !_isMatchClosed(match)).toList();
    final List<String> incomplete = [];
    for (var match in openFinalMatches) {
      final pred = _predictions[match.id];
      if (pred == null || pred['A'] == null || pred['B'] == null) {
        incomplete.add(match.id);
      }
    }

    if (incomplete.isNotEmpty) {
      setState(() {
        _missingFields.addAll(incomplete);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text(
            'POR FAVOR COMPLETA TODOS LOS PRONÓSTICOS DE LAS FINALES',
          ),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final finalIds = openFinalMatches.map((m) => m.id).toSet();
      for (var matchId in _predictions.keys) {
        if (!finalIds.contains(matchId)) continue;
        final scores = _predictions[matchId]!;
        await SupabaseService.savePrediction(
          user.id,
          matchId,
          scores['A']!,
          scores['B']!,
        );
      }

      setState(() {
        _alreadySavedFinal = _hasAllOpenPredictionsFinal();
        _isSaving = false;
      });

      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: AtozColors.burgundy,
            title: const Text(
              '¡PRONÓSTICOS GUARDADOS!',
              style: TextStyle(color: AtozColors.gold),
            ),
            content: const Text(
              'Tus resultados de las Finales han sido registrados. No podrán ser editados.',
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('ENTENDIDO'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error al guardar: $e')));
      }
    }
  }

  void _saveDemo() {
    final completed = _predictions.values.where((scores) {
      return scores['A'] != null && scores['B'] != null;
    }).length;

    if (completed == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text('Coloca al menos un marcador para probar la demo'),
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AtozColors.burgundy,
        title: const Text(
          'DEMO COMPLETADA',
          style: TextStyle(color: AtozColors.gold),
        ),
        content: Text(
          'Probaste $completed pronóstico${completed == 1 ? '' : 's'}. Nada se guardó en la base de datos.',
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('ENTENDIDO'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isDemo ? 'DEMO QUINIELA' : 'MIS PRONÓSTICOS'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AtozColors.gold,
          labelColor: AtozColors.gold,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(text: 'ETAPAS ANTERIORES'),
            Tab(text: 'SEMIFINALES'),
            Tab(text: 'FINAL Y 3ER LUGAR'),
          ],
        ),
        actions: [
          if (_tabController.index == 1 &&
              (widget.isDemo || !_alreadySavedSemis))
            TextButton.icon(
              onPressed: _isSaving ? null : _saveSemis,
              icon: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      Icons.check_circle_outline,
                      color: AtozColors.gold,
                    ),
              label: Text(
                widget.isDemo ? 'PROBAR DEMO' : 'GUARDAR SEMIS',
                style: const TextStyle(color: AtozColors.gold),
              ),
            )
          else if (_tabController.index == 2 &&
              (widget.isDemo || !_alreadySavedFinal))
            TextButton.icon(
              onPressed: _isSaving ? null : _saveFinal,
              icon: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      Icons.check_circle_outline,
                      color: AtozColors.gold,
                    ),
              label: Text(
                widget.isDemo ? 'PROBAR DEMO' : 'GUARDAR FINALES',
                style: const TextStyle(color: AtozColors.gold),
              ),
            )
          else if (_tabController.index == 0)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  'FINALIZADAS',
                  style: TextStyle(
                    color: Colors.white38,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
            )
          else if (_tabController.index == 1 && _alreadySavedSemis)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  'GUARDADAS',
                  style: TextStyle(
                    color: Colors.white38,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
            )
          else if (_tabController.index == 2 && _alreadySavedFinal)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  'GUARDADAS',
                  style: TextStyle(
                    color: Colors.white38,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // ETAPAS ANTERIORES
          Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.black45,
                child: const Text(
                  '⚠️ ETAPAS FINALIZADAS: Las predicciones de las etapas anteriores ya no pueden ser editadas ni guardadas.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 10,
                    fontStyle: FontStyle.italic,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_leaderboard != null && _leaderboard!.isNotEmpty) ...[
                      _buildStage1WinnersBanner(
                        _leaderboard![0],
                        _leaderboard!.length > 1 ? _leaderboard![1] : null,
                      ),
                      const SizedBox(height: 16),
                    ],
                    for (final group in WorldCup2026Data.groups)
                      _buildGroupSection(group),
                    _buildKnockoutSection(
                      '16avos de Final',
                      WorldCup2026Data.knockoutMatches,
                    ),
                    _buildKnockoutSection(
                      '8vos de Final',
                      WorldCup2026Data.octavosMatches,
                    ),
                    _buildKnockoutSection(
                      'Cuartos de Final',
                      WorldCup2026Data.cuartosMatches,
                    ),
                  ],
                ),
              ),
            ],
          ),

          // SEMIFINALES
          Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.black45,
                child: Text(
                  widget.isDemo
                      ? 'MODO DEMO: puedes probar marcadores sin registrarte. Nada se guarda en la base de datos.'
                      : '⚠️ IMPORTANTE: Debes llenar todos los juegos de las Semifinales para poder guardar. Una vez guardados, no se pueden editar.',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 10,
                    fontStyle: FontStyle.italic,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildKnockoutSection(
                      'Semifinales',
                      WorldCup2026Data.semifinalMatches,
                    ),
                  ],
                ),
              ),
            ],
          ),

          // FINAL Y 3ER LUGAR
          Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.black45,
                child: Text(
                  widget.isDemo
                      ? 'MODO DEMO: puedes probar marcadores sin registrarte. Nada se guarda en la base de datos.'
                      : '⚠️ IMPORTANTE: Debes llenar todos los juegos de la Final y Tercer Lugar para poder guardar. Una vez guardados, no se pueden editar.',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 10,
                    fontStyle: FontStyle.italic,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildKnockoutSection(
                      'Tercer Lugar',
                      WorldCup2026Data.tercerLugarMatches,
                    ),
                    _buildKnockoutSection(
                      'Gran Final',
                      WorldCup2026Data.finalMatches,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildGroupSection(String group) {
    final matches = WorldCup2026Data.matchesByGroup(group);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 12),
          child: Row(
            children: [
              const Expanded(child: Divider(color: Colors.white24)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'GRUPO $group',
                  style: const TextStyle(
                    color: AtozColors.gold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                ),
              ),
              const Expanded(child: Divider(color: Colors.white24)),
            ],
          ),
        ),
        for (final match in matches) _buildMatchCard(match),
      ],
    );
  }

  Widget _buildKnockoutSection(String title, List<Match> matches) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 12),
          child: Row(
            children: [
              const Expanded(child: Divider(color: Colors.white24)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  title.toUpperCase(),
                  style: const TextStyle(
                    color: AtozColors.gold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                ),
              ),
              const Expanded(child: Divider(color: Colors.white24)),
            ],
          ),
        ),
        for (final match in matches) _buildMatchCard(match),
      ],
    );
  }

  Widget _buildMatchCard(Match match) {
    final isLocked = _isMatchLockedForUser(match);
    final isMissing = _missingFields.contains(match.id);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Container(
        decoration: isMissing
            ? BoxDecoration(
                border: Border.all(color: Colors.redAccent, width: 2),
                borderRadius: BorderRadius.circular(15),
              )
            : null,
        child: Opacity(
          opacity: isLocked ? 0.7 : 1.0,
          child: FuturisticCard(
            height: 230,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '${match.date.day}/${match.date.month} ${match.date.hour}:${match.date.minute.toString().padLeft(2, '0')} - ${match.venue ?? ''}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AtozColors.gold, fontSize: 12),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildTeamColumn(match.teamA, 'A', match.id, isLocked),
                    const Text(
                      'VS',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                    _buildTeamColumn(match.teamB, 'B', match.id, isLocked),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  bool _isMatchClosed(Match match) {
    if (widget.isDemo) return false;
    return _finishedMatches.contains(match.id) ||
        match.date.difference(DateTime.now()).inMinutes < 30;
  }

  bool _isMatchLockedForUser(Match match) {
    if (widget.isDemo) return false;
    if (match.isEtapa1) return true;
    if (match.isEtapa2) return true;
    if (match.isEtapa3) return true;
    if (match.isEtapa4) return true;
    if (_isMatchClosed(match)) return true;
    if (match.isSemis && _alreadySavedSemis) return true;
    if ((match.isTercerLugar || match.isFinal) && _alreadySavedFinal) return true;
    return false;
  }

  bool _hasSavedPrediction(String matchId) {
    final prediction = _predictions[matchId];
    return prediction != null &&
        prediction['A'] != null &&
        prediction['B'] != null;
  }

  bool _hasAllOpenPredictionsSemis() {
    final openMatches = WorldCup2026Data.semifinalMatches.where(
      (match) => !_isMatchClosed(match),
    );
    if (openMatches.isEmpty) return true;
    return openMatches.every((match) => _hasSavedPrediction(match.id));
  }

  bool _hasAllOpenPredictionsFinal() {
    final openMatches = [
      ...WorldCup2026Data.tercerLugarMatches,
      ...WorldCup2026Data.finalMatches
    ].where((match) => !_isMatchClosed(match));
    if (openMatches.isEmpty) return true;
    return openMatches.every((match) => _hasSavedPrediction(match.id));
  }

  Widget _buildTeamColumn(
    Team team,
    String teamKey,
    String matchId,
    bool isLocked,
  ) {
    if (!_controllers.containsKey(matchId)) {
      _controllers[matchId] = {};
    }
    final controllers = _controllers[matchId]!;
    if (!controllers.containsKey(teamKey)) {
      final currentScore = _predictions[matchId]?[teamKey];
      controllers[teamKey] = TextEditingController(
        text: currentScore != null ? currentScore.toString() : '',
      );
    }
    final controller = controllers[teamKey]!;

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
        const SizedBox(height: 8),
        Text(
          team.code,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: 70,
          child: TextField(
            controller: controller,
            enabled: !isLocked,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AtozColors.gold,
            ),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              hintText: '-',
              hintStyle: const TextStyle(color: Colors.white24),
              filled: true,
              fillColor: isLocked ? Colors.black54 : Colors.black26,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.white12),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AtozColors.gold),
              ),
            ),
            onChanged: (val) => _updateScore(matchId, teamKey, val),
          ),
        ),
      ],
    );
  }

  Widget _buildStage1WinnersBanner(
    Map<String, dynamic>? first,
    Map<String, dynamic>? second,
  ) {
    if (first == null) return const SizedBox.shrink();
    return Container(
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
          color: Colors.black.withOpacity(0.25),
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
    );
  }
}
