import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  // Keys
  static const String _keyToken = 'auth_token';
  static const String _keyUserName = 'user_name';
  static const String _keyUserEmail = 'user_email';
  static const String _keyUserId = 'user_id';
  static const String _keyLocalUrl = 'local_server_url';
  static const String _keyRemoteUrl = 'remote_server_url';
  static const String _keyActiveUrl = 'active_server_url';
  static const String _keyPinnedDevices = 'pinned_devices';

  // --- Auth ---
  static Future<void> saveAuthData({
    required String token,
    required int userId,
    required String name,
    required String email,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
    await prefs.setInt(_keyUserId, userId);
    await prefs.setString(_keyUserName, name);
    await prefs.setString(_keyUserEmail, email);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  static Future<String?> getUserName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUserName);
  }

  static Future<String?> getUserEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUserEmail);
  }

  static Future<int?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_keyUserId);
  }

  static Future<void> clearAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyUserName);
    await prefs.remove(_keyUserEmail);
  }

  // --- Server URLs ---
  static Future<void> saveLocalUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLocalUrl, url);
  }

  static Future<void> saveRemoteUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyRemoteUrl, url);
  }

  static Future<void> saveActiveUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyActiveUrl, url);
  }

  static Future<String?> getLocalUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyLocalUrl);
  }

  static Future<String?> getRemoteUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyRemoteUrl);
  }

  static Future<String?> getActiveUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyActiveUrl);
  }

  // --- Pinned Devices ---
  static Future<Set<int>> getPinnedDevices() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keyPinnedDevices) ?? [];
    return list.map((e) => int.tryParse(e) ?? -1).where((id) => id >= 0).toSet();
  }

  static Future<void> savePinnedDevices(Set<int> ids) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_keyPinnedDevices, ids.map((e) => e.toString()).toList());
  }
}
