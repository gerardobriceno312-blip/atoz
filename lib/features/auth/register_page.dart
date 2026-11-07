import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/colors.dart';
import '../../core/services/supabase_service.dart';
import '../../widgets/futuristic_card.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  XFile? _receiptFile;
  Uint8List? _receiptBytes;
  bool _isUploading = false;
  bool _obscurePassword = true;

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      final bytes = await pickedFile.readAsBytes();
      setState(() {
        _receiptFile = pickedFile;
        _receiptBytes = bytes;
      });
    }
  }

  Future<void> _submit() async {
    if (_formKey.currentState!.validate() && _receiptBytes != null) {
      setState(() => _isUploading = true);
      try {
        final response = await SupabaseService.signUp(
          _emailController.text.trim(),
          _passwordController.text,
          _nameController.text.trim(),
        );

        if (response.user != null) {
          final extension = _receiptFile!.name.split('.').last;
          await SupabaseService.uploadReceipt(response.user!.id, _receiptBytes!, extension);
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Registro enviado. Espera la aprobación del administrador.'),
                backgroundColor: AtozColors.darkGreen,
              ),
            );
            Navigator.pop(context);
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: ${e.toString()}')),
          );
        }
      } finally {
        if (mounted) setState(() => _isUploading = false);
      }
    } else if (_receiptBytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, sube tu comprobante de pago.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('REGISTRO')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Completa tus datos para participar',
                style: TextStyle(fontSize: 18, color: AtozColors.gold),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Nombre Completo',
                  prefixIcon: Icon(Icons.person_outline, color: AtozColors.gold),
                ),
                validator: (value) => value!.isEmpty ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Correo Electrónico',
                  prefixIcon: Icon(Icons.email_outlined, color: AtozColors.gold),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Campo requerido';
                  final emailRegExp = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                  if (!emailRegExp.hasMatch(value.trim())) {
                    return 'Formato de correo inválido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Contraseña',
                  prefixIcon: const Icon(Icons.lock_outline, color: AtozColors.gold),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                      color: AtozColors.gold,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Campo requerido';
                  if (value.length < 6) return 'Mínimo 6 caracteres';
                  return null;
                },
              ),
              const SizedBox(height: 32),
              const Text(
                'Comprobante de Pago',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: _pickImage,
                child: FuturisticCard(
                  height: 200,
                  child: _receiptBytes == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.cloud_upload_outlined,
                                size: 48, color: AtozColors.gold),
                            const SizedBox(height: 8),
                            Text(
                              'Toca para subir imagen',
                              style: TextStyle(color: Colors.white.withOpacity(0.5)),
                            ),
                          ],
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.memory(_receiptBytes!, fit: BoxFit.cover, width: double.infinity),
                        ),
                ),
              ),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isUploading ? null : _submit,
                  child: _isUploading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('ENVIAR SOLICITUD'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
