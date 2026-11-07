import '../../widgets/futuristic_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/colors.dart';
import '../../main.dart';
import '../../core/services/supabase_service.dart';
import '../../core/data/world_cup_data.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AdminDashboard extends StatefulWidget {
  const AdminDashboard({super.key});

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late Future<List<Map<String, dynamic>>> _usersFuture;
  late Future<List<Map<String, dynamic>>> _matchesFuture;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
    _usersFuture = SupabaseService.getAllUsers();
    _matchesFuture = SupabaseService.getMatches();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _approveUser(String userId, String name) async {
    await SupabaseService.approveUser(userId);
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Usuario $name aprobado')));
      setState(() {
        _usersFuture = SupabaseService.getAllUsers();
      });
    }
  }

  void _unapproveUser(String userId, String name) async {
    try {
      await Supabase.instance.client
          .from('profiles')
          .update({'approved': false})
          .eq('id', userId);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Usuario $name desaprobado')));
        setState(() {
          _usersFuture = SupabaseService.getAllUsers();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error al desaprobar: $e')));
      }
    }
  }

  void _importOfficialMatches() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: AtozColors.gold),
      ),
    );

    try {
      final matchesList = WorldCup2026Data.matches
          .map(
            (m) => {
              'id': m.id,
              'team_a': m.teamA.name,
              'team_b': m.teamB.name,
              'group': m.group,
              'date': m.date.toIso8601String(),
              'is_finished': false,
            },
          )
          .toList();

      await SupabaseService.importMatches(matchesList);
      await SupabaseService.recalculateAllScores();

      if (mounted) {
        Navigator.pop(context); // Dismiss loading
        setState(() {
          _matchesFuture = SupabaseService.getMatches();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Partidos importados y sincronizados correctamente.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Dismiss loading
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al importar partidos: $e')),
        );
      }
    }
  }

  void _showReceipt(String url) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black87,
        insetPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 20),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: Container(
            width: double.infinity,
            height: MediaQuery.of(context).size.height * 0.7,
            child: Column(
              children: [
                AppBar(
                  backgroundColor: Colors.transparent,
                  elevation: 0,
                  automaticallyImplyLeading: false,
                  title: const Text(
                    'Comprobante de Pago',
                    style: TextStyle(fontSize: 14),
                  ),
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                Expanded(
                  child: InteractiveViewer(
                    panEnabled: true,
                    minScale: 0.5,
                    maxScale: 4.0,
                    child: Center(
                      child: Image.network(
                        url,
                        fit: BoxFit.contain,
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return const Center(
                            child: CircularProgressIndicator(
                              color: AtozColors.gold,
                            ),
                          );
                        },
                        errorBuilder: (context, error, stackTrace) =>
                            const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.broken_image,
                                    size: 50,
                                    color: Colors.white24,
                                  ),
                                  SizedBox(height: 10),
                                  Text(
                                    'No se pudo cargar la imagen',
                                    style: TextStyle(color: Colors.white24),
                                  ),
                                ],
                              ),
                            ),
                      ),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12.0),
                  child: Text(
                    'Pellizca para hacer zoom / Arrastra para mover',
                    style: TextStyle(color: Colors.white38, fontSize: 10),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _addMatchDialog() {
    final teamAController = TextEditingController();
    final teamBController = TextEditingController();
    final groupController = TextEditingController();
    DateTime selectedDate = DateTime.now();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AtozColors.burgundy,
        title: const Text(
          'AGREGAR PARTIDO',
          style: TextStyle(color: AtozColors.gold),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: teamAController,
                decoration: const InputDecoration(labelText: 'EQUIPO A'),
              ),
              TextField(
                controller: teamBController,
                decoration: const InputDecoration(labelText: 'EQUIPO B'),
              ),
              TextField(
                controller: groupController,
                decoration: const InputDecoration(labelText: 'GRUPO/FASE'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  final DateTime? picked = await showDatePicker(
                    context: context,
                    initialDate: selectedDate,
                    firstDate: DateTime(2026),
                    lastDate: DateTime(2027),
                  );
                  if (picked != null) selectedDate = picked;
                },
                child: const Text('SELECCIONAR FECHA'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCELAR'),
          ),
          ElevatedButton(
            onPressed: () async {
              await SupabaseService.addMatch({
                'team_a': teamAController.text,
                'team_b': teamBController.text,
                'group': groupController.text,
                'date': selectedDate.toIso8601String(),
              });
              if (mounted) {
                Navigator.pop(context);
                setState(() {
                  _matchesFuture = SupabaseService.getMatches();
                });
              }
            },
            child: const Text('GUARDAR'),
          ),
        ],
      ),
    );
  }

  Future<void> _saveMatchResult(
    Map<String, dynamic> match,
    int realA,
    int realB,
  ) async {
    final matchId = match['id'].toString();
    await SupabaseService.saveMatchResult(matchId, realA, realB);
    await SupabaseService.recalculateAllScores();

    if (mounted) {
      setState(() => _matchesFuture = SupabaseService.getMatches());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Resultado guardado y puntos actualizados'),
        ),
      );
    }
  }

  Future<void> _resetMatchResult(Map<String, dynamic> match) async {
    final matchId = match['id'].toString();
    await SupabaseService.resetMatchResult(matchId);
    await SupabaseService.recalculateAllScores();

    if (mounted) {
      setState(() => _matchesFuture = SupabaseService.getMatches());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Marcador reiniciado y puntos actualizados'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PANEL DE CONTROL'),
        actions: [
          if (_tabController.index == 1)
            IconButton(
              tooltip: 'Importar/Sincronizar Partidos',
              icon: const Icon(Icons.sync_alt, color: AtozColors.gold),
              onPressed: _importOfficialMatches,
            ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white38),
            onPressed: () async {
              await Supabase.instance.client.auth.signOut();
              if (mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => const WelcomeScreen(),
                  ),
                  (route) => false,
                );
              }
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AtozColors.gold,
          tabs: const [
            Tab(text: 'USUARIOS'),
            Tab(text: 'PARTIDOS'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [_buildUsersTab(), _buildMatchesTab()],
      ),
      floatingActionButton: _tabController.index == 1
          ? FloatingActionButton(
              backgroundColor: AtozColors.gold,
              onPressed: _addMatchDialog,
              child: const Icon(Icons.add, color: AtozColors.burgundy),
            )
          : null,
    );
  }

  Widget _buildUsersTab() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _usersFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting)
          return const Center(child: CircularProgressIndicator());
        if (!snapshot.hasData || snapshot.data!.isEmpty)
          return const Center(child: Text('No hay usuarios registrados.'));

        final allUsers = snapshot.data!;
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: allUsers.length,
          itemBuilder: (context, index) {
            final user = allUsers[index];
            final bool isApproved = user['approved'] ?? false;

            return Padding(
              padding: const EdgeInsets.only(bottom: 16.0),
              child: FuturisticCard(
                height: 180,
                child: Column(
                  children: [
                    Row(
                      children: [
                        const CircleAvatar(
                          backgroundColor: AtozColors.burgundy,
                          child: Icon(Icons.person, color: AtozColors.gold),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user['full_name'] ?? 'Sin nombre',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(height: 4),
                              if (user['receipt_url'] != null)
                                TextButton.icon(
                                  onPressed: () =>
                                      _showReceipt(user['receipt_url']),
                                  icon: const Icon(
                                    Icons.image_outlined,
                                    size: 16,
                                    color: AtozColors.gold,
                                  ),
                                  label: const Text(
                                    'Ver Comprobante',
                                    style: TextStyle(
                                      color: AtozColors.gold,
                                      fontSize: 12,
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    minimumSize: const Size(0, 0),
                                  ),
                                )
                              else
                                Text(
                                  'Sin comprobante',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.4),
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isApproved
                                ? Colors.green.withOpacity(0.2)
                                : Colors.amber.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isApproved ? Colors.green : Colors.amber,
                            ),
                          ),
                          child: Text(
                            isApproved ? 'APROBADO' : 'PENDIENTE',
                            style: TextStyle(
                              color: isApproved ? Colors.green : Colors.amber,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        if (!isApproved) ...[
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Para rechazar, por favor comuníquese directamente con el usuario.',
                                    ),
                                  ),
                                );
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.redAccent,
                              ),
                              child: const Text('RECHAZAR'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () => _approveUser(
                                user['id'],
                                user['full_name'] ?? 'Usuario',
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AtozColors.darkGreen,
                              ),
                              child: const Text('APROBAR'),
                            ),
                          ),
                        ] else ...[
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _unapproveUser(
                                user['id'],
                                user['full_name'] ?? 'Usuario',
                              ),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.amber,
                              ),
                              child: const Text('DESAPROBAR'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Container(
                              height: 36,
                              decoration: BoxDecoration(
                                color: Colors.green.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.check,
                                    color: Colors.green,
                                    size: 16,
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    'APROBADO',
                                    style: TextStyle(
                                      color: Colors.green,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildMatchesTab() {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _matchesFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting)
          return const Center(child: CircularProgressIndicator());
        final matches = _mergeOfficialMatches(snapshot.data ?? []);
        final groupedMatches = _groupMatches(matches);
        final groups = groupedMatches.keys.toList()..sort();

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: OutlinedButton.icon(
                onPressed: _importOfficialMatches,
                icon: const Icon(Icons.sync),
                label: const Text('SINCRONIZAR CALENDARIO COMPLETO'),
              ),
            ),
            for (final group in groups)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Theme(
                  data: Theme.of(
                    context,
                  ).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    initiallyExpanded: true,
                    collapsedIconColor: AtozColors.gold,
                    iconColor: AtozColors.gold,
                    title: Text(
                      group == 'Sin grupo'
                          ? group
                          : (group.length == 1
                              ? 'GRUPO $group'
                              : (group == '16avos'
                                  ? '16avos de Final'
                                  : (group == '8vos'
                                      ? '8vos de Final'
                                      : (group == '4tos'
                                          ? 'Cuartos de Final'
                                          : (group == 'Semis'
                                              ? 'Semifinales'
                                              : (group == '3er Lugar'
                                                  ? 'Partido por el Tercer Lugar'
                                                  : (group == 'Final'
                                                      ? 'Gran Final'
                                                      : group))))))),
                      style: const TextStyle(
                        color: AtozColors.gold,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                    ),
                    children: [
                      for (final match in groupedMatches[group]!)
                        AdminMatchResultCard(
                          match: match,
                          onSave: _saveMatchResult,
                          onReset: _resetMatchResult,
                        ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Map<String, List<Map<String, dynamic>>> _groupMatches(
    List<Map<String, dynamic>> matches,
  ) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final match in matches) {
      final group = (match['group'] ?? 'Sin grupo').toString();
      grouped.putIfAbsent(group, () => []).add(match);
    }
    for (final groupMatches in grouped.values) {
      groupMatches.sort((a, b) {
        final dateA =
            DateTime.tryParse((a['date'] ?? '').toString()) ?? DateTime(2100);
        final dateB =
            DateTime.tryParse((b['date'] ?? '').toString()) ?? DateTime(2100);
        return dateA.compareTo(dateB);
      });
    }
    return grouped;
  }

  List<Map<String, dynamic>> _mergeOfficialMatches(
    List<Map<String, dynamic>> databaseMatches,
  ) {
    final merged = <String, Map<String, dynamic>>{
      for (final match in WorldCup2026Data.matches)
        match.id: SupabaseService.officialMatchToRow(match),
    };

    for (final match in databaseMatches) {
      final matchId = SupabaseService.officialMatchIdForRow(match);
      if (matchId == null) continue;
      merged[matchId] = {...?merged[matchId], ...match};
      merged[matchId]!['id'] = matchId;
    }

    return merged.values.toList();
  }
}

class AdminMatchResultCard extends StatefulWidget {
  final Map<String, dynamic> match;
  final Future<void> Function(Map<String, dynamic> match, int realA, int realB)
  onSave;
  final Future<void> Function(Map<String, dynamic> match) onReset;

  const AdminMatchResultCard({
    super.key,
    required this.match,
    required this.onSave,
    required this.onReset,
  });

  @override
  State<AdminMatchResultCard> createState() => _AdminMatchResultCardState();
}

class _AdminMatchResultCardState extends State<AdminMatchResultCard> {
  late final TextEditingController _scoreAController;
  late final TextEditingController _scoreBController;
  bool _isSaving = false;
  bool _isResetting = false;
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    _scoreAController = TextEditingController(text: _scoreText('score_a'));
    _scoreBController = TextEditingController(text: _scoreText('score_b'));
  }

  @override
  void didUpdateWidget(covariant AdminMatchResultCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.match['id'] != widget.match['id'] ||
        oldWidget.match['score_a'] != widget.match['score_a'] ||
        oldWidget.match['score_b'] != widget.match['score_b']) {
      _scoreAController.text = _scoreText('score_a');
      _scoreBController.text = _scoreText('score_b');
      _isEditing = false;
    }
  }

  @override
  void dispose() {
    _scoreAController.dispose();
    _scoreBController.dispose();
    super.dispose();
  }

  String _scoreText(String key) {
    final value = widget.match[key];
    return value == null ? '' : value.toString();
  }

  Future<void> _save() async {
    final realA = int.tryParse(_scoreAController.text);
    final realB = int.tryParse(_scoreBController.text);
    if (realA == null || realB == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Coloca los goles de ambos equipos')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      await widget.onSave(widget.match, realA, realB);
      if (mounted) setState(() => _isEditing = false);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _cancelEdit() {
    setState(() {
      _scoreAController.text = _scoreText('score_a');
      _scoreBController.text = _scoreText('score_b');
      _isEditing = false;
    });
  }

  Future<void> _reset() async {
    setState(() => _isResetting = true);
    try {
      await widget.onReset(widget.match);
      if (mounted) {
        setState(() {
          _scoreAController.clear();
          _scoreBController.clear();
          _isEditing = false;
        });
      }
    } finally {
      if (mounted) setState(() => _isResetting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final officialMatch = WorldCup2026Data.matchById(
      widget.match['id'].toString(),
    );
    final teamA =
        officialMatch?.teamA ??
        Team(
          name: widget.match['team_a'] ?? 'Equipo A',
          code: widget.match['team_a'] ?? 'A',
          flagUrl: 'https://flagcdn.com/un.svg',
        );
    final teamB =
        officialMatch?.teamB ??
        Team(
          name: widget.match['team_b'] ?? 'Equipo B',
          code: widget.match['team_b'] ?? 'B',
          flagUrl: 'https://flagcdn.com/un.svg',
        );
    final date = DateTime.tryParse((widget.match['date'] ?? '').toString());
    final isFinished = widget.match['is_finished'] ?? false;
    final canEditScore = !isFinished || _isEditing;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: FuturisticCard(
        height: isFinished ? 316 : 274,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              date == null
                  ? (officialMatch?.venue ?? '')
                  : '${date.day}/${date.month} ${date.hour}:${date.minute.toString().padLeft(2, '0')} - ${officialMatch?.venue ?? ''}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AtozColors.gold, fontSize: 12),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _AdminTeamResultColumn(
                  team: teamA,
                  controller: _scoreAController,
                  enabled: canEditScore && !_isSaving,
                ),
                Column(
                  children: [
                    const Text(
                      'VS',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Icon(
                      isFinished ? Icons.check_circle : Icons.pending_actions,
                      color: isFinished ? Colors.greenAccent : Colors.white38,
                      size: 18,
                    ),
                  ],
                ),
                _AdminTeamResultColumn(
                  team: teamB,
                  controller: _scoreBController,
                  enabled: canEditScore && !_isSaving,
                ),
              ],
            ),
            const SizedBox(height: 14),
            _buildActionButtons(isFinished),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(bool isFinished) {
    if (isFinished && !_isEditing) {
      return Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: (_isSaving || _isResetting)
                  ? null
                  : () => setState(() => _isEditing = true),
              icon: const Icon(Icons.edit_note),
              label: const Text('EDITAR RESULTADO'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: (_isSaving || _isResetting) ? null : _reset,
              icon: _isResetting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.restart_alt),
              label: const Text('REINICIAR MARCADOR'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.redAccent,
              ),
            ),
          ),
        ],
      );
    }

    if (isFinished && _isEditing) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: (_isSaving || _isResetting) ? null : _cancelEdit,
              icon: const Icon(Icons.close),
              label: const Text('CANCELAR'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: (_isSaving || _isResetting) ? null : _save,
              icon: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: const Text('GUARDAR CAMBIO'),
            ),
          ),
        ],
      );
    }

    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: (_isSaving || _isResetting) ? null : _save,
        icon: _isSaving
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.save_outlined),
        label: const Text('GUARDAR RESULTADO'),
      ),
    );
  }
}

class _AdminTeamResultColumn extends StatelessWidget {
  final Team team;
  final TextEditingController controller;
  final bool enabled;

  const _AdminTeamResultColumn({
    required this.team,
    required this.controller,
    required this.enabled,
  });

  @override
  Widget build(BuildContext context) {
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
            enabled: enabled,
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
              fillColor: enabled ? Colors.black26 : Colors.black54,
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
          ),
        ),
      ],
    );
  }
}
