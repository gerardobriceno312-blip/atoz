import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:typed_data';
import '../data/world_cup_data.dart';
import '../utils/scoring_utils.dart';

class SupabaseService {
  static final SupabaseClient _client = Supabase.instance.client;

  // Authentication
  static Future<AuthResponse> signUp(
    String email,
    String password,
    String name,
  ) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': name},
    );

    if (response.user != null) {
      // Create profile row manually to ensure it exists for admin dashboard
      await _client.from('profiles').upsert({
        'id': response.user!.id,
        'full_name': name,
        'approved': false,
      });
    }
    return response;
  }

  static Future<AuthResponse> signIn(String email, String password) async {
    return await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  static Future<void> resetPassword(String email) async {
    // IMPORTANTE: Asegúrate de que esta URL coincida con tu Site URL en Supabase
    await _client.auth.resetPasswordForEmail(email);
  }

  static Future<void> updatePassword(String newPassword) async {
    await _client.auth.updateUser(UserAttributes(password: newPassword));
  }

  static Future<bool> isApproved(String userId) async {
    final user = _client.auth.currentUser;
    // Hardcoded bypass for the admin account
    if (user?.email == 'admin@atoz.com') return true;

    try {
      final res = await _client
          .from('profiles')
          .select('approved')
          .eq('id', userId)
          .maybeSingle();
      return res != null && res['approved'] == true;
    } catch (e) {
      return false;
    }
  }

  // Database: User Profile & Approval
  static Future<void> uploadReceipt(
    String userId,
    Uint8List fileBytes,
    String extension,
  ) async {
    final fileName =
        'receipts/$userId-${DateTime.now().millisecondsSinceEpoch}.$extension';
    await _client.storage
        .from('quiniela_assets')
        .uploadBinary(fileName, fileBytes);

    // Update user profile with receipt URL
    final url = _client.storage.from('quiniela_assets').getPublicUrl(fileName);
    await _client
        .from('profiles')
        .update({'receipt_url': url})
        .eq('id', userId);
  }

  static Future<List<Map<String, dynamic>>> getPendingUsers() async {
    return await _client.from('profiles').select().eq('approved', false);
  }

  static Future<List<Map<String, dynamic>>> getAllUsers() async {
    return await _client.from('profiles').select().order('full_name');
  }

  static Future<void> approveUser(String userId) async {
    await _client.from('profiles').update({'approved': true}).eq('id', userId);
  }

  // Quiniela Logic
  static Future<void> savePrediction(
    String userId,
    String matchId,
    int scoreA,
    int scoreB,
  ) async {
    await _client.from('predictions').upsert({
      'user_id': userId,
      'match_id': matchId,
      'score_a': scoreA,
      'score_b': scoreB,
    }, onConflict: 'user_id,match_id');
  }

  static Future<List<Map<String, dynamic>>> getLeaderboard() async {
    final profiles = await _client.from('profiles').select('id, full_name, points');

    final leaderboard = [
      for (final profile in profiles)
        {
          'id': profile['id'],
          'full_name': profile['full_name'],
          'points': profile['points'] ?? 0,
        },
    ];
    leaderboard.sort((a, b) {
      final pointsA = _readScore(a['points']);
      final pointsB = _readScore(b['points']);
      final pointsComparison = pointsB.compareTo(pointsA);
      if (pointsComparison != 0) return pointsComparison;
      return (a['full_name'] ?? '').toString().compareTo(
        (b['full_name'] ?? '').toString(),
      );
    });
    return leaderboard;
  }

  static Future<List<Map<String, dynamic>>> getMatches() async {
    return await _client.from('matches').select().order('date');
  }

  static Future<List<Map<String, dynamic>>> getFinishedMatchResults() async {
    final matches = await _client
        .from('matches')
        .select()
        .eq('is_finished', true)
        .order('date');

    return [
      for (final match in matches)
        if (match['score_a'] != null && match['score_b'] != null)
          {...match, 'official_match_id': officialMatchIdForRow(match)},
    ];
  }

  static Future<void> addMatch(Map<String, dynamic> matchData) async {
    await _client.from('matches').insert(matchData);
  }

  static Future<void> importMatches(
    List<Map<String, dynamic>> matchesList,
  ) async {
    final existingMatches = await getMatches();

    for (final matchData in matchesList) {
      final officialMatch = WorldCup2026Data.matchById(
        matchData['id'].toString(),
      );
      if (officialMatch == null) continue;

      final payload = {
        'team_a': officialMatch.teamA.name,
        'team_b': officialMatch.teamB.name,
        'group': officialMatch.group,
        'date': officialMatch.date.toIso8601String(),
      };

      final existingMatch = _findDatabaseMatchForOfficial(
        existingMatches,
        officialMatch,
      );
      if (existingMatch == null) {
        await _client.from('matches').insert({
          ...payload,
          'is_finished': false,
        });
      } else {
        await _client
            .from('matches')
            .update(payload)
            .eq('id', existingMatch['id']);
      }
    }
  }

  static Future<void> saveMatchResult(
    String matchId,
    int scoreA,
    int scoreB,
  ) async {
    final officialMatch = WorldCup2026Data.matchById(matchId);
    if (officialMatch == null) {
      throw Exception('Partido oficial no encontrado: $matchId');
    }

    final existingMatches = await getMatches();
    final existingMatchesForOfficial = _findDatabaseMatchesForOfficial(
      existingMatches,
      officialMatch,
    );
    final payload = {
      'team_a': officialMatch.teamA.name,
      'team_b': officialMatch.teamB.name,
      'group': officialMatch.group,
      'date': officialMatch.date.toIso8601String(),
      'score_a': scoreA,
      'score_b': scoreB,
      'is_finished': true,
    };

    if (existingMatchesForOfficial.isEmpty) {
      await _client.from('matches').insert(payload);
    } else {
      for (final existingMatch in existingMatchesForOfficial) {
        await _client
            .from('matches')
            .update(payload)
            .eq('id', existingMatch['id']);
      }
    }
  }

  static Future<void> resetMatchResult(String matchId) async {
    final officialMatch = WorldCup2026Data.matchById(matchId);
    if (officialMatch == null) {
      throw Exception('Partido oficial no encontrado: $matchId');
    }

    final existingMatches = await getMatches();
    final existingMatchesForOfficial = _findDatabaseMatchesForOfficial(
      existingMatches,
      officialMatch,
    );
    if (existingMatchesForOfficial.isEmpty) return;

    for (final existingMatch in existingMatchesForOfficial) {
      await _client
          .from('matches')
          .update({'score_a': null, 'score_b': null, 'is_finished': false})
          .eq('id', existingMatch['id']);
    }

    await _client.from('predictions').delete().eq('match_id', matchId);
  }

  static Future<Set<String>> getFinishedMatchIds() async {
    final matchesResponse = await _client
        .from('matches')
        .select()
        .eq('is_finished', true);
    return {
      for (final match in matchesResponse)
        if (officialMatchIdForRow(match) != null) officialMatchIdForRow(match)!,
    };
  }

  static Future<void> recalculateAllScores() async {
    final profiles = await _client.from('profiles').select('id');
    final userPoints = await _calculateUserPoints(profiles);

    // Keep the cached points column in sync when policies allow it. The
    // leaderboard also calculates live points, so ranking does not depend on
    // these updates succeeding for every profile.
    for (var entry in userPoints.entries) {
      await _client
          .from('profiles')
          .update({'points': entry.value})
          .eq('id', entry.key);
    }
  }

  static Future<Map<String, int>> _calculateUserPoints(
    List<dynamic> profiles,
  ) async {
    final matchesResponse = await _client
        .from('matches')
        .select()
        .eq('is_finished', true);
    final Map<String, Map<String, dynamic>> finishedMatches = {
      for (var m in matchesResponse)
        if (officialMatchIdForRow(m) != null) officialMatchIdForRow(m)!: m,
    };
    for (final match in matchesResponse) {
      final rowId = match['id']?.toString();
      if (rowId != null && rowId.isNotEmpty) {
        finishedMatches[rowId] = match;
      }
    }

    final predictions = await _client.from('predictions').select();

    final Map<String, int> userPoints = {
      for (var p in profiles) p['id'].toString(): 0,
    };

    for (var pred in predictions) {
      final userId = pred['user_id'].toString();
      final matchId = pred['match_id'].toString();

      if (finishedMatches.containsKey(matchId)) {
        final match = finishedMatches[matchId]!;
        final points = ScoringUtils.calculatePoints(
          predA: _readScore(pred['score_a']),
          predB: _readScore(pred['score_b']),
          realA: _readScore(match['score_a']),
          realB: _readScore(match['score_b']),
        );
        userPoints[userId] = (userPoints[userId] ?? 0) + points;
      }
    }

    return userPoints;
  }

  static String? officialMatchIdForRow(Map<String, dynamic> row) {
    final rowId = row['id']?.toString();
    if (rowId != null && WorldCup2026Data.matchById(rowId) != null) {
      return rowId;
    }

    for (final match in WorldCup2026Data.matches) {
      if (_matchesOfficialRow(match, row)) return match.id;
    }
    return null;
  }

  static Map<String, dynamic> officialMatchToRow(Match match) {
    return {
      'id': match.id,
      'team_a': match.teamA.name,
      'team_b': match.teamB.name,
      'group': match.group,
      'date': match.date.toIso8601String(),
      'is_finished': false,
    };
  }

  static Map<String, dynamic>? _findDatabaseMatchForOfficial(
    List<Map<String, dynamic>> rows,
    Match officialMatch,
  ) {
    for (final row in rows) {
      if (_matchesOfficialRow(officialMatch, row)) return row;
    }
    return null;
  }

  static List<Map<String, dynamic>> _findDatabaseMatchesForOfficial(
    List<Map<String, dynamic>> rows,
    Match officialMatch,
  ) {
    return [
      for (final row in rows)
        if (_matchesOfficialRow(officialMatch, row)) row,
    ];
  }

  static bool _matchesOfficialRow(
    Match officialMatch,
    Map<String, dynamic> row,
  ) {
    return row['team_a'] == officialMatch.teamA.name &&
        row['team_b'] == officialMatch.teamB.name &&
        row['group'] == officialMatch.group;
  }

  static int _readScore(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    final parsed = int.tryParse(value?.toString() ?? '');
    if (parsed == null) {
      throw Exception('Marcador inválido al recalcular puntos: $value');
    }
    return parsed;
  }
}
