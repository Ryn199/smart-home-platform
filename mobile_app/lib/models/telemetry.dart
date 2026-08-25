/// Aliased model classes matching new api_service.dart naming
class TempHumidityReading {
  final int id;
  final int deviceId;
  final double temperature;
  final double humidity;
  final DateTime recordedAt;

  TempHumidityReading({
    required this.id,
    required this.deviceId,
    required this.temperature,
    required this.humidity,
    required this.recordedAt,
  });

  factory TempHumidityReading.fromJson(Map<String, dynamic> json) {
    return TempHumidityReading(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      deviceId: json['deviceId'] is int
          ? json['deviceId']
          : int.parse(json['deviceId'].toString()),
      temperature: (json['temperature'] as num).toDouble(),
      humidity: (json['humidity'] as num).toDouble(),
      recordedAt: DateTime.parse(json['recordedAt']),
    );
  }
}

class TelemetryStats {
  final String deviceUid;
  final double? currentTemp;
  final double? currentHum;
  final DateTime? currentRecordedAt;
  final double? tempMin;
  final double? tempMax;
  final double? tempAvg;
  final double? humMin;
  final double? humMax;
  final double? humAvg;
  final int totalReadings;

  TelemetryStats({
    required this.deviceUid,
    this.currentTemp,
    this.currentHum,
    this.currentRecordedAt,
    this.tempMin,
    this.tempMax,
    this.tempAvg,
    this.humMin,
    this.humMax,
    this.humAvg,
    required this.totalReadings,
  });

  factory TelemetryStats.fromJson(Map<String, dynamic> json) {
    final current = json['current'] ?? {};
    final stats = json['stats'] ?? {};
    return TelemetryStats(
      deviceUid: json['deviceUid'] ?? '',
      currentTemp: current['temperature'] != null
          ? (current['temperature'] as num).toDouble()
          : null,
      currentHum: current['humidity'] != null
          ? (current['humidity'] as num).toDouble()
          : null,
      currentRecordedAt: current['recordedAt'] != null
          ? DateTime.tryParse(current['recordedAt'].toString())
          : null,
      tempMin: stats['tempMin'] != null ? (stats['tempMin'] as num).toDouble() : null,
      tempMax: stats['tempMax'] != null ? (stats['tempMax'] as num).toDouble() : null,
      tempAvg: stats['tempAvg'] != null ? (stats['tempAvg'] as num).toDouble() : null,
      humMin: stats['humMin'] != null ? (stats['humMin'] as num).toDouble() : null,
      humMax: stats['humMax'] != null ? (stats['humMax'] as num).toDouble() : null,
      humAvg: stats['humAvg'] != null ? (stats['humAvg'] as num).toDouble() : null,
      totalReadings: stats['totalReadings'] is int ? stats['totalReadings'] : 0,
    );
  }
}
