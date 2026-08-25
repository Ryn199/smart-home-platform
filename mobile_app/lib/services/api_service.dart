import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/device.dart';
import '../models/telemetry.dart';
import '../models/user.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  /// Ambil token dari storage dan return header Authorization
  Future<Map<String, String>> _authHeaders() async {
    final token = await StorageService.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  void _checkStatus(http.Response response) {
    if (response.statusCode >= 400) {
      String message = 'Request gagal (${response.statusCode})';
      try {
        final body = jsonDecode(response.body);
        message = body['message'] ?? message;
      } catch (_) {}
      throw ApiException(message, statusCode: response.statusCode);
    }
  }

  // --- Auth ---
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse(ApiConfig.loginUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    _checkStatus(response);
    return jsonDecode(response.body);
  }

  Future<User> getMe() async {
    final response = await http.get(
      Uri.parse(ApiConfig.meUrl),
      headers: await _authHeaders(),
    );
    _checkStatus(response);
    return User.fromJson(jsonDecode(response.body));
  }

  // --- Devices ---
  Future<List<Device>> getDevices() async {
    final response = await http.get(
      Uri.parse(ApiConfig.devicesUrl),
      headers: await _authHeaders(),
    );
    _checkStatus(response);
    final List<dynamic> data = jsonDecode(response.body);
    return data.map((d) => Device.fromJson(d)).toList();
  }

  Future<Device> getDeviceDetail(int id) async {
    final response = await http.get(
      Uri.parse(ApiConfig.deviceDetailUrl(id)),
      headers: await _authHeaders(),
    );
    _checkStatus(response);
    return Device.fromJson(jsonDecode(response.body));
  }

  Future<void> executeCommand(int deviceId, String command, [Map<String, dynamic>? params]) async {
    final body = <String, dynamic>{'command': command};
    if (params != null) body.addAll(params);
    final response = await http.post(
      Uri.parse(ApiConfig.deviceCommandsUrl(deviceId)),
      headers: await _authHeaders(),
      body: jsonEncode(body),
    );
    _checkStatus(response);
  }

  // --- Temp & Humidity ---
  Future<TelemetryStats?> getTempHumidityStats(String deviceUid) async {
    final response = await http.get(
      Uri.parse(ApiConfig.tempHumidityStatsUrl(deviceUid)),
      headers: await _authHeaders(),
    );
    if (response.statusCode == 404) return null;
    _checkStatus(response);
    final data = jsonDecode(response.body);
    return TelemetryStats.fromJson(data);
  }

  Future<List<TempHumidityReading>> getTempHumidityHistory(
    String deviceUid, {
    int limit = 50,
    String period = '1h',
  }) async {
    final url = '${ApiConfig.tempHumidityHistoryUrl(deviceUid)}?limit=$limit&period=$period';
    final response = await http.get(
      Uri.parse(url),
      headers: await _authHeaders(),
    );
    if (response.statusCode == 404) return [];
    _checkStatus(response);
    final List<dynamic> data = jsonDecode(response.body);
    return data.map((e) => TempHumidityReading.fromJson(e)).toList();
  }
}
