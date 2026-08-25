import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/api_config.dart';
import 'config/app_theme.dart';
import 'models/device.dart';
import 'providers/auth_provider.dart';
import 'providers/device_provider.dart';
import 'screens/login_screen.dart';
import 'screens/main_navigation_screen.dart';
import 'screens/device_detail_screen.dart';
import 'services/api_service.dart';
import 'services/storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Restore saved URLs
  final localUrl = await StorageService.getLocalUrl();
  final remoteUrl = await StorageService.getRemoteUrl();
  final activeUrl = await StorageService.getActiveUrl();
  if (localUrl != null) ApiConfig.setLocalUrl(localUrl);
  if (remoteUrl != null) ApiConfig.setRemoteUrl(remoteUrl);
  if (activeUrl != null) ApiConfig.setActiveUrl(activeUrl);

  runApp(const SmartHomeUserApp());
}

class SmartHomeUserApp extends StatelessWidget {
  const SmartHomeUserApp({super.key});

  @override
  Widget build(BuildContext context) {
    final apiService = ApiService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(apiService)..init()),
        ChangeNotifierProvider(create: (_) => DeviceProvider()),
      ],
      child: MaterialApp(
        title: 'Smart Home',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const _AppRoot(),
        onGenerateRoute: (settings) {
          if (settings.name == '/device-detail') {
            final device = settings.arguments as Device;
            return MaterialPageRoute(
              builder: (_) => DeviceDetailScreen(device: device),
            );
          }
          return null;
        },
      ),
    );
  }
}

class _AppRoot extends StatelessWidget {
  const _AppRoot();

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (ctx, auth, _) {
        switch (auth.status) {
          case AuthStatus.uninitialized:
            return const Scaffold(
              backgroundColor: AppColors.surface,
              body: Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            );
          case AuthStatus.authenticated:
            // Init devices after auth (capture provider before async gap)
            final dp = ctx.read<DeviceProvider>();
            Future.microtask(() => dp.init());
            return const MainNavigationScreen();
          case AuthStatus.unauthenticated:
          case AuthStatus.authenticating:
            return const LoginScreen();
        }
      },
    );
  }
}
