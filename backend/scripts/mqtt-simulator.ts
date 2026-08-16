import * as mqtt from 'mqtt';

const brokerUrl = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883';
console.log(`[Simulator] Connecting to MQTT broker at ${brokerUrl}...`);

const client = mqtt.connect(brokerUrl);

// Simulated Devices Configuration
const devices = [
  {
    type: 'CUSTOM_SENSOR',
    homeId: '1',
    roomId: '1',
    deviceUid: 'sensor-sim-001',
    telemetryIntervalMs: 5000,
  },
  {
    type: 'SMART_DOOR',
    homeId: '1',
    roomId: '1',
    deviceUid: 'door-sim-001',
    state: { door: 'closed', lock: 'locked' },
  },
  {
    type: 'SMART_CURTAIN',
    homeId: '1',
    roomId: '1',
    deviceUid: 'curtain-sim-001',
    state: { position: 100, state: 'stopped' },
  },
  {
    type: 'EXHAUST_FAN',
    homeId: '1',
    roomId: '2',
    deviceUid: 'fan-sim-001',
    state: { power: false, speed: 0 },
  },
];

client.on('connect', () => {
  console.log('[Simulator] Connected to MQTT broker successfully!');

  // Subscribe to command topics for interactive devices
  for (const device of devices) {
    const commandTopic = `home/${device.homeId}/${device.roomId}/${device.deviceUid}/command`;
    client.subscribe(commandTopic, (err) => {
      if (err) console.error(`[Simulator] Failed to subscribe to ${commandTopic}`);
      else console.log(`[Simulator] Listening for commands on: ${commandTopic}`);
    });
  }

  // Start periodic telemetry for CUSTOM_SENSOR
  setInterval(() => {
    const sensorDevice = devices.find((d) => d.type === 'CUSTOM_SENSOR');
    if (sensorDevice) {
      const topic = `home/${sensorDevice.homeId}/${sensorDevice.roomId}/${sensorDevice.deviceUid}/telemetry`;
      const payload = {
        temperature: parseFloat((24 + Math.random() * 6).toFixed(1)),
        humidity: parseFloat((50 + Math.random() * 20).toFixed(1)),
        pressure: parseFloat((1010 + Math.random() * 5).toFixed(1)),
      };

      client.publish(topic, JSON.stringify(payload));
      console.log(`[Simulator] Published telemetry -> ${topic}:`, payload);
    }
  }, 5000);

  // Publish initial states
  for (const device of devices) {
    if ('state' in device) {
      const stateTopic = `home/${device.homeId}/${device.roomId}/${device.deviceUid}/state`;
      client.publish(stateTopic, JSON.stringify(device.state));
      console.log(`[Simulator] Published initial state -> ${stateTopic}:`, device.state);
    }
  }
});

// Handle incoming commands and update state
client.on('message', (topic, message) => {
  console.log(`[Simulator] Command received on [${topic}]: ${message.toString()}`);

  try {
    const command = JSON.parse(message.toString());
    const parts = topic.split('/');
    const deviceUid = parts[3];
    const device = devices.find((d) => d.deviceUid === deviceUid);

    if (!device) return;

    if (device.type === 'SMART_DOOR') {
      if (command.action === 'unlock') device.state = { door: 'closed', lock: 'unlocked' };
      if (command.action === 'lock') device.state = { door: 'closed', lock: 'locked' };
      const stateTopic = `home/${device.homeId}/${device.roomId}/${device.deviceUid}/state`;
      client.publish(stateTopic, JSON.stringify(device.state));
      console.log(`[Simulator] Responded with new state -> ${stateTopic}:`, device.state);
    } else if (device.type === 'SMART_CURTAIN') {
      if (command.action === 'open') device.state = { position: 100, state: 'stopped' };
      if (command.action === 'close') device.state = { position: 0, state: 'stopped' };
      if (command.action === 'set_position')
        device.state = { position: command.position ?? 50, state: 'stopped' };
      const stateTopic = `home/${device.homeId}/${device.roomId}/${device.deviceUid}/state`;
      client.publish(stateTopic, JSON.stringify(device.state));
      console.log(`[Simulator] Responded with new state -> ${stateTopic}:`, device.state);
    } else if (device.type === 'EXHAUST_FAN') {
      if (command.action === 'on') device.state = { power: true, speed: 1 };
      if (command.action === 'off') device.state = { power: false, speed: 0 };
      if (command.action === 'set_speed')
        device.state = { power: command.speed > 0, speed: command.speed ?? 1 };
      const stateTopic = `home/${device.homeId}/${device.roomId}/${device.deviceUid}/state`;
      client.publish(stateTopic, JSON.stringify(device.state));
      console.log(`[Simulator] Responded with new state -> ${stateTopic}:`, device.state);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Simulator] Error processing command: ${msg}`);
  }
});
