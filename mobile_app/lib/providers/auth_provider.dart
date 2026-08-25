import 'package:flutter/material.dart';
import '../config/api_config.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

enum AuthStatus { uninitialized, authenticated, unauthenticated, authenticating }

class AuthProvider extends ChangeNotifier {
  final ApiService _api;
  AuthStatus _status = AuthStatus.uninitialized;
  User? _user;
  String? _errorMessage;

  AuthProvider(this._api);

  AuthStatus get status => _status;
  User? get user => _user;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  Future<void> init() async {
    final token = await StorageService.getToken();
    final activeUrl = await StorageService.getActiveUrl();
    final localUrl = await StorageService.getLocalUrl();
    final remoteUrl = await StorageService.getRemoteUrl();

    if (localUrl != null) ApiConfig.setLocalUrl(localUrl);
    if (remoteUrl != null) ApiConfig.setRemoteUrl(remoteUrl);
    if (activeUrl != null) ApiConfig.setActiveUrl(activeUrl);

    if (token != null) {
      try {
        _user = await _api.getMe();
        _status = AuthStatus.authenticated;
      } catch (_) {
        await StorageService.clearAuth();
        _status = AuthStatus.unauthenticated;
      }
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  /// Login dengan dual URL auto-resolve
  Future<bool> login(String email, String password) async {
    _status = AuthStatus.authenticating;
    _errorMessage = null;
    notifyListeners();

    try {
      // Auto-resolve URL (local → remote)
      final resolvedUrl = await ApiConfig.autoResolveUrl();
      await StorageService.saveActiveUrl(resolvedUrl);

      // Perform login
      final data = await _api.login(email, password);
      // Backend returns: { accessToken: string, user: UserWithoutPassword }
      final token = data['accessToken'] as String;
      final userJson = data['user'] as Map<String, dynamic>;
      _user = User.fromJson(userJson);

      await StorageService.saveAuthData(
        token: token,
        userId: _user!.id,
        name: _user!.name,
        email: _user!.email,
      );

      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await StorageService.clearAuth();
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
