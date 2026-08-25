import 'dart:async';
import 'package:http/http.dart' as http;

/// Dual URL config dengan auto-fallback logic.
/// Urutan coba: Local → Remote → Error
class ApiConfig {
  static String _localUrl = '';
  static String _remoteUrl = '';
  static String _activeUrl = 'http://10.0.2.2:3000/api'; // default fallback

  static String get activeUrl => _activeUrl;
  static String get localUrl => _localUrl;
  static String get remoteUrl => _remoteUrl;

  static void setLocalUrl(String url) {
    if (url.trim().isNotEmpty) _localUrl = url.trim();
  }

  static void setRemoteUrl(String url) {
    if (url.trim().isNotEmpty) _remoteUrl = url.trim();
  }

  static void setActiveUrl(String url) {
    if (url.trim().isNotEmpty) _activeUrl = url.trim();
  }

  /// Auto-resolve: coba local dulu (3s timeout), lalu remote (5s), lalu throw
  static Future<String> autoResolveUrl() async {
    // 1. Coba Local
    if (_localUrl.isNotEmpty) {
      final localHealth = '${_stripApiSuffix(_localUrl)}/api/health';
      try {
        final response = await http
            .get(Uri.parse(localHealth))
            .timeout(const Duration(seconds: 3));
        if (response.statusCode < 500) {
          _activeUrl = _localUrl;
          return _localUrl;
        }
      } catch (_) {
        // Local gagal, lanjut ke remote
      }
    }

    // 2. Coba Remote
    if (_remoteUrl.isNotEmpty) {
      final remoteHealth = '${_stripApiSuffix(_remoteUrl)}/api/health';
      try {
        final response = await http
            .get(Uri.parse(remoteHealth))
            .timeout(const Duration(seconds: 5));
        if (response.statusCode < 500) {
          _activeUrl = _remoteUrl;
          return _remoteUrl;
        }
      } catch (_) {
        // Remote gagal juga
      }
    }

    // 3. Jika kedua URL kosong, coba pakai _activeUrl langsung (default)
    if (_localUrl.isEmpty && _remoteUrl.isEmpty) {
      // Gunakan activeUrl yang sudah tersimpan (atau default 10.0.2.2)
      return _activeUrl;
    }

    // 4. Kedua dikonfigurasi tapi keduanya gagal
    throw ServerUnavailableException(
      localUrl: _localUrl.isNotEmpty ? _localUrl : null,
      remoteUrl: _remoteUrl.isNotEmpty ? _remoteUrl : null,
    );
  }

  /// Cek apakah ada minimal satu URL yang dikonfigurasi
  static bool get hasAnyUrl => _localUrl.isNotEmpty || _remoteUrl.isNotEmpty;

  static String _stripApiSuffix(String url) {
    final cleaned = url.trim().replaceAll(RegExp(r'/+$'), '');
    if (cleaned.endsWith('/api')) {
      return cleaned.substring(0, cleaned.length - 4);
    }
    return cleaned;
  }

  // --- URL Builders ---
  static String get loginUrl => '$_activeUrl/auth/login';
  static String get meUrl => '$_activeUrl/auth/me';
  static String get devicesUrl => '$_activeUrl/devices';
  static String deviceDetailUrl(int id) => '$_activeUrl/devices/$id';
  static String deviceCommandsUrl(int id) => '$_activeUrl/devices/$id/commands';
  static String devicePresenceUrl(int id) => '$_activeUrl/devices/$id/presence';
  static String tempHumidityHistoryUrl(String deviceUid) =>
      '$_activeUrl/temp-humidity/$deviceUid/history';
  static String tempHumidityStatsUrl(String deviceUid) =>
      '$_activeUrl/temp-humidity/$deviceUid/stats';
}

class ServerUnavailableException implements Exception {
  final String? localUrl;
  final String? remoteUrl;

  ServerUnavailableException({this.localUrl, this.remoteUrl});

  @override
  String toString() {
    if (localUrl != null && remoteUrl != null) {
      return 'Tidak dapat terhubung ke server lokal ($localUrl) maupun server remote ($remoteUrl). Periksa koneksi atau URL Anda.';
    }
    if (localUrl != null) {
      return 'Tidak dapat terhubung ke server lokal ($localUrl).';
    }
    if (remoteUrl != null) {
      return 'Tidak dapat terhubung ke server remote ($remoteUrl).';
    }
    return 'Tidak ada URL server yang dikonfigurasi. Masukkan Server URL di pengaturan login.';
  }
}
