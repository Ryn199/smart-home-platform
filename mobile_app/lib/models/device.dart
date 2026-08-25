class DeviceRoom {
  final int id;
  final String name;
  final String? homeName;

  DeviceRoom({
    required this.id,
    required this.name,
    this.homeName,
  });

  factory DeviceRoom.fromJson(Map<String, dynamic> json) {
    return DeviceRoom(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      name: json['name'] ?? 'Room',
      homeName: json['home'] != null ? json['home']['name'] : null,
    );
  }
}

class Device {
  final int id;
  final String name;
  final String deviceUid;
  final String deviceType;
  final String status;
  final int roomId;
  final DeviceRoom? room;
  final DateTime? lastSeenAt;
  final Map<String, dynamic> metadata;

  Device({
    required this.id,
    required this.name,
    required this.deviceUid,
    required this.deviceType,
    required this.status,
    required this.roomId,
    this.room,
    this.lastSeenAt,
    required this.metadata,
  });

  bool get isOnline => status.toUpperCase() == 'ONLINE';

  double? get currentTemperature {
    final temp = metadata['temperature'] ?? metadata['temp'];
    if (temp == null) return null;
    return double.tryParse(temp.toString());
  }

  double? get currentHumidity {
    final hum = metadata['humidity'] ?? metadata['hum'];
    if (hum == null) return null;
    return double.tryParse(hum.toString());
  }

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      name: json['name'] ?? 'Unnamed Device',
      deviceUid: json['deviceUid'] ?? '',
      deviceType: json['deviceType'] ?? 'TEMP_HUMIDITY',
      status: json['status'] ?? 'UNKNOWN',
      roomId: json['roomId'] is int
          ? json['roomId']
          : int.parse(json['roomId'].toString()),
      room: json['room'] != null ? DeviceRoom.fromJson(json['room']) : null,
      lastSeenAt: json['lastSeenAt'] != null
          ? DateTime.tryParse(json['lastSeenAt'].toString())
          : null,
      metadata: json['metadata'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['metadata'])
          : {},
    );
  }
}
