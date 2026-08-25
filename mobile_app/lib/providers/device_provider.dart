import 'package:flutter/material.dart';
import '../models/device.dart';
import '../models/telemetry.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class DeviceProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Device> _devices = [];
  Set<int> _pinnedDeviceIds = {};
  bool _isLoading = false;
  String? _errorMessage;
  String _searchQuery = '';
  String _selectedFilter = 'ALL';

  // Telemetry cache per deviceUid
  final Map<String, TelemetryStats> _statsMap = {};
  final Map<String, List<TempHumidityReading>> _historyMap = {};
  bool _isLoadingTelemetry = false;

  List<Device> get devices => _devices;
  Set<int> get pinnedDeviceIds => _pinnedDeviceIds;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get searchQuery => _searchQuery;
  String get selectedFilter => _selectedFilter;
  bool get isLoadingTelemetry => _isLoadingTelemetry;

  List<Device> get filteredDevices {
    return _devices.where((d) {
      final matchesSearch =
          d.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              d.deviceUid.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              (d.room?.name ?? '').toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesFilter = _selectedFilter == 'ALL' || d.deviceType == _selectedFilter;
      return matchesSearch && matchesFilter;
    }).toList();
  }

  List<Device> get pinnedDevices =>
      _devices.where((d) => _pinnedDeviceIds.contains(d.id)).toList();

  List<Device> get tempHumidityDevices =>
      _devices.where((d) => d.deviceType == 'TEMP_HUMIDITY').toList();

  int get onlineCount => _devices.where((d) => d.isOnline).length;
  int get offlineCount => _devices.where((d) => !d.isOnline).length;

  double? get averageTemperature {
    final devs = tempHumidityDevices.where((d) => d.currentTemperature != null);
    if (devs.isEmpty) return null;
    return devs.fold(0.0, (s, d) => s + d.currentTemperature!) / devs.length;
  }

  double? get averageHumidity {
    final devs = tempHumidityDevices.where((d) => d.currentHumidity != null);
    if (devs.isEmpty) return null;
    return devs.fold(0.0, (s, d) => s + d.currentHumidity!) / devs.length;
  }

  Future<void> init() async {
    _pinnedDeviceIds = await StorageService.getPinnedDevices();
    await fetchDevices();
  }

  Future<void> togglePin(int deviceId) async {
    if (_pinnedDeviceIds.contains(deviceId)) {
      _pinnedDeviceIds.remove(deviceId);
    } else {
      _pinnedDeviceIds.add(deviceId);
    }
    await StorageService.savePinnedDevices(_pinnedDeviceIds);
    notifyListeners();
  }

  bool isPinned(int deviceId) => _pinnedDeviceIds.contains(deviceId);

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setFilter(String filter) {
    _selectedFilter = filter;
    notifyListeners();
  }

  Future<void> fetchDevices() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _devices = await _apiService.getDevices();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  TelemetryStats? getStatsFor(String deviceUid) => _statsMap[deviceUid];
  List<TempHumidityReading>? getHistoryFor(String deviceUid) => _historyMap[deviceUid];

  Future<void> fetchTelemetry(String deviceUid, {String period = '24h'}) async {
    _isLoadingTelemetry = true;
    notifyListeners();
    try {
      final stats = await _apiService.getTempHumidityStats(deviceUid);
      if (stats != null) _statsMap[deviceUid] = stats;
      final history = await _apiService.getTempHumidityHistory(deviceUid, period: period);
      _historyMap[deviceUid] = history;
    } catch (_) {
    } finally {
      _isLoadingTelemetry = false;
      notifyListeners();
    }
  }

  Future<void> executeDeviceCommand(int deviceId, String action,
      {Map<String, dynamic>? payload}) async {
    try {
      await _apiService.executeCommand(deviceId, action, payload);
      await fetchDevices();
    } catch (_) {}
  }
}
