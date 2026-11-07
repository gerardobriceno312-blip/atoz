import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'widgets/futuristic_card.dart';
import 'features/auth/register_page.dart';
import 'features/auth/login_page.dart';
import 'features/quiniela/quiniela_page.dart';
import 'features/leaderboard/leaderboard_page.dart';
import 'features/admin/admin_dashboard.dart';
import 'features/results/match_results_page.dart';
import 'package:atoz_quiniela/core/services/supabase_service.dart';
import 'core/theme.dart';
import 'core/colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'https://woqhzmetfbfubkcdqtmh.supabase.co',
    anonKey: 'sb_publishable_vAh5dgmwqIeE7xWYz2QtzQ__CBMD-c7',
  );

  runApp(const ProviderScope(child: AtozQuinielaApp()));
}

class AtozQuinielaApp extends StatelessWidget {
  const AtozQuinielaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Quiniela Mundial 2026 - Ato\'z',
      debugShowCheckedModeBanner: false,
      theme: AtozTheme.darkTheme,
      home: const WelcomeScreen(),
    );
  }
}

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  @override
  void initState() {
    super.initState();
    _setupAuthListener();
  }

  void _setupAuthListener() {
    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.passwordRecovery) {
        _showUpdatePasswordDialog();
      }
    });
  }

  void _showUpdatePasswordDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: AtozColors.burgundy,
        title: const Text(
          'NUEVA CONTRASEÑA',
          style: TextStyle(color: AtozColors.gold),
        ),
        content: TextField(
          controller: controller,
          obscureText: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'Ingresa tu nueva clave',
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () async {
              if (controller.text.length < 6) return;
              await SupabaseService.updatePassword(controller.text);
              if (mounted) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Contraseña actualizada correctamente'),
                  ),
                );
              }
            },
            child: const Text('ACTUALIZAR'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Gradient
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.5, -0.5),
                radius: 1.5,
                colors: [Color(0xFF3D0C09), AtozColors.background],
              ),
            ),
          ),
          // Subtle glowing orb
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AtozColors.gold.withOpacity(0.05),
                boxShadow: [
                  BoxShadow(
                    color: AtozColors.gold.withOpacity(0.1),
                    blurRadius: 100,
                    spreadRadius: 50,
                  ),
                ],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),
                  // Logo Placeholder / Icon
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(
                        0.95,
                      ), // Fondo claro para resaltar el logo
                      border: Border.all(color: AtozColors.gold, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AtozColors.gold.withOpacity(0.2),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Image.asset(
                      'assets/logo.png',
                      height: 180,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) {
                        return const Text(
                          'ATO\'Z',
                          style: TextStyle(
                            color: AtozColors.burgundy,
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 32),
                  Text(
                    'QUINIELA MUNDIAL 2026',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.philosopher(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: AtozColors.gold,
                      letterSpacing: 2,
                    ),
                  ),
                  Text(
                    'ATO\'Z BODEGÓN & MARKET',
                    style: GoogleFonts.philosopher(
                      fontSize: 16,
                      color: Colors.white70,
                      letterSpacing: 4,
                    ),
                  ),
                  const SizedBox(height: 48),
                  FuturisticCard(
                    height: 120,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          '¡Participa y gana premios increíbles!',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Regístrate con tu comprobante de pago',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.6),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  if (Supabase.instance.client.auth.currentUser != null) ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const MainNavigation(),
                            ),
                          );
                        },
                        child: Text(
                          Supabase.instance.client.auth.currentUser?.email ==
                                  'admin@atoz.com'
                              ? 'IR AL PANEL DE GESTIÓN'
                              : 'IR A MI QUINIELA',
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton.icon(
                      onPressed: () async {
                        await Supabase.instance.client.auth.signOut();
                        if (mounted) setState(() {});
                      },
                      icon: const Icon(
                        Icons.logout,
                        color: Colors.white38,
                        size: 16,
                      ),
                      label: const Text(
                        'CERRAR SESIÓN',
                        style: TextStyle(color: Colors.white38, fontSize: 12),
                      ),
                    ),
                  ] else ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const RegisterPage(),
                            ),
                          );
                        },
                        child: const Text('REGISTRARSE'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const DemoNavigation(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.sports_esports),
                        label: const Text('PROBAR DEMO'),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const LoginPage(),
                          ),
                        );
                      },
                      child: const Text(
                        'YA TENGO CUENTA',
                        style: TextStyle(color: AtozColors.gold),
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  if (Supabase.instance.client.auth.currentUser?.email ==
                      'admin@atoz.com')
                    TextButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const MainNavigation(),
                          ),
                        );
                      },
                      child: const Text(
                        'PANEL ADMIN (CONTROL)',
                        style: TextStyle(color: Colors.white38, fontSize: 10),
                      ),
                    ),
                  const Spacer(),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16.0),
                    child: Text(
                      'Diseñada por Ing. David Zara',
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 12,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DemoNavigation extends StatefulWidget {
  const DemoNavigation({super.key});

  @override
  State<DemoNavigation> createState() => _DemoNavigationState();
}

class _DemoNavigationState extends State<DemoNavigation> {
  int _selectedIndex = 0;
  static const _titles = ['DEMO', 'RESULTADOS', 'RANKING'];

  @override
  Widget build(BuildContext context) {
    const pages = [
      QuinielaPage(isDemo: true),
      MatchResultsPage(showAppBar: false),
      LeaderboardPage(showAppBar: false),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_selectedIndex]),
        actions: [
          IconButton(
            tooltip: 'Salir de demo',
            icon: const Icon(Icons.close, color: Colors.white60),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
      body: IndexedStack(index: _selectedIndex, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        backgroundColor: AtozColors.surface,
        selectedItemColor: AtozColors.gold,
        unselectedItemColor: Colors.white38,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.sports_esports),
            label: 'Demo',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.scoreboard),
            label: 'Resultados',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.leaderboard),
            label: 'Ranking',
          ),
        ],
      ),
    );
  }
}

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _selectedIndex = 0;
  bool _isApproved = false;
  bool _isLoading = true;
  bool _isAdminVerified = false;

  @override
  void initState() {
    super.initState();
    _checkApproval();
    _setupAuthListener();
  }

  void _setupAuthListener() {
    // Ya se maneja en WelcomeScreen
  }

  Future<void> _verifyAdminPassword() async {
    final controller = TextEditingController();
    bool obscureText = true;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AtozColors.burgundy,
          title: const Text(
            'ACCESO RESTRINGIDO',
            style: TextStyle(color: AtozColors.gold),
          ),
          content: TextField(
            controller: controller,
            obscureText: obscureText,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'Contraseña de Supervisor',
              suffixIcon: IconButton(
                icon: Icon(
                  obscureText ? Icons.visibility_off : Icons.visibility,
                  color: AtozColors.gold,
                ),
                onPressed: () =>
                    setDialogState(() => obscureText = !obscureText),
              ),
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                if (controller.text == 'Venezuela14-') {
                  setState(() => _isAdminVerified = true);
                  Navigator.pop(context);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Contraseña incorrecta')),
                  );
                }
              },
              child: const Text('ENTRAR'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _checkApproval() async {
    setState(() => _isLoading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        final approved = await SupabaseService.isApproved(user.id);
        if (user.email == 'admin@atoz.com' && !_isAdminVerified) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _verifyAdminPassword(),
          );
        }
        if (mounted) {
          setState(() {
            _isApproved = approved;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AtozColors.gold),
              SizedBox(height: 16),
              Text(
                'Verificando estado...',
                style: TextStyle(color: AtozColors.gold),
              ),
            ],
          ),
        ),
      );
    }

    final isAdmin =
        Supabase.instance.client.auth.currentUser?.email == 'admin@atoz.com';

    final List<Widget> pages = isAdmin
        ? [
            _isAdminVerified
                ? const AdminDashboard()
                : const Scaffold(
                    body: Center(child: Text('Acceso Administrativo...')),
                  ),
            const LeaderboardPage(),
          ]
        : [
            _isApproved
                ? const QuinielaPage()
                : Scaffold(
                    body: Container(
                      decoration: const BoxDecoration(
                        gradient: RadialGradient(
                          colors: [Color(0xFF3D0C09), AtozColors.background],
                          radius: 1.5,
                        ),
                      ),
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.access_time_filled,
                                size: 80,
                                color: AtozColors.gold,
                              ),
                              const SizedBox(height: 32),
                              const Text(
                                'SOLICITUD EN REVISIÓN',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: AtozColors.gold,
                                  letterSpacing: 1.5,
                                ),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'Tu comprobante de pago está siendo revisado por nuestro equipo. Recibirás acceso automáticamente una vez verificado.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white70,
                                  height: 1.5,
                                ),
                              ),
                              const SizedBox(height: 48),
                              SizedBox(
                                width: 200,
                                child: ElevatedButton(
                                  onPressed: _checkApproval,
                                  child: const Text('ACTUALIZAR'),
                                ),
                              ),
                              const SizedBox(height: 16),
                              TextButton(
                                onPressed: () async {
                                  await Supabase.instance.client.auth.signOut();
                                  if (mounted) {
                                    Navigator.of(context).pushAndRemoveUntil(
                                      MaterialPageRoute(
                                        builder: (context) =>
                                            const WelcomeScreen(),
                                      ),
                                      (route) => false,
                                    );
                                  }
                                },
                                child: const Text(
                                  'CERRAR SESIÓN',
                                  style: TextStyle(color: Colors.white38),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
            const MatchResultsPage(),
            const LeaderboardPage(),
          ];
    final titles = isAdmin
        ? ['QUINIELA', 'RANKING']
        : ['QUINIELA', 'RESULTADOS', 'RANKING'];

    return Scaffold(
      appBar: (isAdmin && _selectedIndex == 0)
          ? null // AdminDashboard tiene su propio AppBar con TabBar
          : AppBar(
              title: Text(titles[_selectedIndex]),
              actions: [
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
            ),
      body: IndexedStack(index: _selectedIndex, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        backgroundColor: AtozColors.surface,
        selectedItemColor: AtozColors.gold,
        unselectedItemColor: Colors.white38,
        items: [
          BottomNavigationBarItem(
            icon: Icon(
              isAdmin ? Icons.admin_panel_settings : Icons.sports_soccer,
            ),
            label: isAdmin ? 'Gestión' : 'Quiniela',
          ),
          if (!isAdmin)
            const BottomNavigationBarItem(
              icon: Icon(Icons.scoreboard),
              label: 'Resultados',
            ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.leaderboard),
            label: 'Ranking',
          ),
        ],
      ),
    );
  }
}
