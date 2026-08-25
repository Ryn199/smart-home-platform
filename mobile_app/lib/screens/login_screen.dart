import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/api_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/storage_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _localUrlCtrl = TextEditingController();
  final _remoteUrlCtrl = TextEditingController();

  bool _showServerSettings = false;
  bool _obscurePassword = true;
  String? _connectingStatus; // "Connecting to local…" / "Trying remote…" / null

  @override
  void initState() {
    super.initState();
    _loadSavedUrls();
  }

  Future<void> _loadSavedUrls() async {
    final local = await StorageService.getLocalUrl();
    final remote = await StorageService.getRemoteUrl();
    if (local != null) _localUrlCtrl.text = local;
    if (remote != null) _remoteUrlCtrl.text = remote;
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _localUrlCtrl.dispose();
    _remoteUrlCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    // Capture auth provider BEFORE any async gap (lint: use_build_context_synchronously)
    final authProvider = context.read<AuthProvider>();

    // Save URL configs
    final localUrl = _localUrlCtrl.text.trim();
    final remoteUrl = _remoteUrlCtrl.text.trim();

    if (localUrl.isNotEmpty) {
      ApiConfig.setLocalUrl(localUrl);
      await StorageService.saveLocalUrl(localUrl);
    }
    if (remoteUrl.isNotEmpty) {
      ApiConfig.setRemoteUrl(remoteUrl);
      await StorageService.saveRemoteUrl(remoteUrl);
    }

    // Show connecting feedback during URL resolution
    setState(() => _connectingStatus = 'Menghubungkan ke server lokal…');

    // Delayed feedback if local is slow
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && _connectingStatus != null) {
        setState(() => _connectingStatus = 'Mencoba server remote…');
      }
    });

    await authProvider.login(_emailCtrl.text.trim(), _passwordCtrl.text);

    if (mounted) {
      setState(() => _connectingStatus = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceContainerLow,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Brand
                _buildBrandHeader(),
                const SizedBox(height: 28),

                // Card
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.outlineVariant),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Error banner
                        _buildErrorBanner(),

                        // Email field
                        _buildLabel('Email'),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          validator: (v) =>
                              (v == null || !v.contains('@')) ? 'Email tidak valid' : null,
                          decoration: const InputDecoration(
                            hintText: 'email@example.com',
                            prefixIcon: Icon(Icons.email_outlined, size: 18,
                                color: AppColors.onSurfaceVariant),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Password field
                        _buildLabel('Password'),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _passwordCtrl,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _handleLogin(),
                          validator: (v) =>
                              (v == null || v.isEmpty) ? 'Password wajib diisi' : null,
                          decoration: InputDecoration(
                            hintText: '••••••••',
                            prefixIcon: const Icon(Icons.lock_outline, size: 18,
                                color: AppColors.onSurfaceVariant),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 18,
                                color: AppColors.onSurfaceVariant,
                              ),
                              onPressed: () =>
                                  setState(() => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Server Settings toggle
                        GestureDetector(
                          onTap: () =>
                              setState(() => _showServerSettings = !_showServerSettings),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                const Icon(Icons.settings_ethernet,
                                    size: 15, color: AppColors.onSurfaceVariant),
                                const SizedBox(width: 6),
                                Text(
                                  'Server Settings',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.onSurfaceVariant,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const Spacer(),
                                Icon(
                                  _showServerSettings
                                      ? Icons.keyboard_arrow_up
                                      : Icons.keyboard_arrow_down,
                                  size: 18,
                                  color: AppColors.onSurfaceVariant,
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Collapsible server settings
                        if (_showServerSettings) ...[
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceContainerLow,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.outlineVariant),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Info banner
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryFixed.withValues(alpha: 0.5),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.info_outline,
                                          size: 14, color: AppColors.primary),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          'Sistem akan mencoba Local URL terlebih dahulu. Jika gagal, otomatis beralih ke Remote URL.',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.primary,
                                            height: 1.4,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 14),

                                // Local URL
                                _buildLabel('Local Server URL'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _localUrlCtrl,
                                  keyboardType: TextInputType.url,
                                  textInputAction: TextInputAction.next,
                                  decoration: const InputDecoration(
                                    hintText: 'http://192.168.1.100:3000/api',
                                    prefixIcon: Icon(Icons.wifi, size: 16,
                                        color: AppColors.onSurfaceVariant),
                                  ),
                                ),
                                const SizedBox(height: 12),

                                // Remote URL
                                _buildLabel('Remote Server URL'),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _remoteUrlCtrl,
                                  keyboardType: TextInputType.url,
                                  textInputAction: TextInputAction.done,
                                  decoration: const InputDecoration(
                                    hintText: 'https://api.mysmarthome.com/api',
                                    prefixIcon: Icon(Icons.cloud_outlined, size: 16,
                                        color: AppColors.onSurfaceVariant),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],

                        const SizedBox(height: 20),

                        // Login button
                        _buildLoginButton(),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.primaryFixed,
            borderRadius: BorderRadius.circular(18),
          ),
          child: const Icon(
            Icons.home_filled,
            color: AppColors.primary,
            size: 34,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Smart Home',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurface,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Sign in to monitor your devices',
          style: TextStyle(fontSize: 13, color: AppColors.onSurfaceVariant),
        ),
      ],
    );
  }

  Widget _buildErrorBanner() {
    return Consumer<AuthProvider>(
      builder: (ctx, auth, _) {
        final error = auth.errorMessage;
        if (error == null && _connectingStatus == null) return const SizedBox.shrink();

        final isConnecting = _connectingStatus != null;

        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isConnecting
                  ? AppColors.primaryFixed.withValues(alpha: 0.5)
                  : AppColors.errorContainer.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isConnecting
                    ? AppColors.primary.withValues(alpha: 0.3)
                    : AppColors.error.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                if (isConnecting)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  )
                else
                  const Icon(Icons.error_outline, size: 16, color: AppColors.error),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isConnecting ? _connectingStatus! : error!,
                    style: TextStyle(
                      fontSize: 12,
                      color: isConnecting ? AppColors.primary : AppColors.error,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLoginButton() {
    return Consumer<AuthProvider>(
      builder: (ctx, auth, _) {
        final isLoading = auth.status == AuthStatus.authenticating;
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: isLoading ? null : _handleLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.onPrimary,
                    ),
                  )
                : const Text(
                    'Sign In',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
          ),
        );
      },
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.onSurfaceVariant,
        letterSpacing: 0.6,
      ),
    );
  }
}
