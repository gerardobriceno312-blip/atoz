import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/colors.dart';
import '../../core/services/supabase_service.dart';
import '../../widgets/futuristic_card.dart';
import '../../main.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  Future<void> _signIn() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isLoading = true);
      try {
        await SupabaseService.signIn(
          _emailController.text.trim(),
          _passwordController.text,
        );
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const MainNavigation()),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: Correo o contraseña incorrectos')),
          );
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('INICIAR SESIÓN')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const SizedBox(height: 20),
              FuturisticCard(
                height: 300,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'CORREO ELECTRÓNICO',
                        prefixIcon: Icon(Icons.email_outlined, color: AtozColors.gold),
                      ),
                      validator: (val) => val == null || val.isEmpty ? 'Requerido' : null,
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        labelText: 'CONTRASEÑA',
                        prefixIcon: const Icon(Icons.lock_outline, color: AtozColors.gold),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_off : Icons.visibility,
                            color: AtozColors.gold,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      validator: (val) => val == null || val.isEmpty ? 'Requerido' : null,
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _signIn,
                        child: _isLoading 
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text('ENTRAR'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              TextButton(
                onPressed: () {
                  final recoveryEmailController = TextEditingController();
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      backgroundColor: AtozColors.burgundy,
                      title: const Text('RECUPERAR CONTRASEÑA', style: TextStyle(color: AtozColors.gold, fontSize: 16)),
                      content: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Ingresa tu correo para recibir un enlace de restauración.', style: TextStyle(color: Colors.white, fontSize: 12)),
                          const SizedBox(height: 16),
                          TextField(
                            controller: recoveryEmailController,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(labelText: 'Correo Electrónico'),
                          ),
                        ],
                      ),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context), child: const Text('CANCELAR')),
                        ElevatedButton(
                          onPressed: () async {
                            if (recoveryEmailController.text.isEmpty) return;
                            try {
                              await SupabaseService.resetPassword(recoveryEmailController.text);
                              if (mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Correo de recuperación enviado')),
                                );
                              }
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Error al enviar el correo')),
                                );
                              }
                            }
                          },
                          child: const Text('ENVIAR'),
                        ),
                      ],
                    ),
                  );
                },
                child: const Text('¿Olvidaste tu contraseña?', style: TextStyle(color: Colors.white38)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
