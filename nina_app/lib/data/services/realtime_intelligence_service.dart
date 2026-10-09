import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/constants/app_constants.dart';

enum IntelligenceUpdateType {
  healthChanged,
  signalDetected,
  triggerDetected,
  coachingGenerated,
  notificationCreated,
}

/// Manages the WebSocket connection to the Nina OS intelligence namespace.
///
/// Implements exponential backoff on failure with a max-retry cap so that
/// the app never enters an infinite reconnect storm when the backend is
/// unavailable (e.g. dev mode, no server running).
class RealtimeIntelligenceService {
  io.Socket? _socket;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();

  // Reconnect state
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  static const int _baseDelaySeconds = 2;

  bool _disposed = false;

  Stream<Map<String, dynamic>> get stream => _controller.stream;

  void connect(String userId) {
    if (_disposed) return;

    _socket = io.io(
      '${AppConstants.baseUrl}/intelligence',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setQuery({'userId': userId})
          // Disable socket.io auto-reconnect — we manage it manually with backoff
          .disableAutoConnect()
          .disableReconnection()
          .build(),
    );

    _attachListeners(userId);
    _socket!.connect();
  }

  void _attachListeners(String userId) {
    _socket!.onConnect((_) {
      _reconnectAttempts = 0; // reset on successful connection
      _startHeartbeat(userId);
    });

    _socket!.onDisconnect((_) {
      _stopHeartbeat();
      _scheduleReconnect(userId);
    });

    _socket!.onConnectError((err) {
      _stopHeartbeat();
      _scheduleReconnect(userId);
    });

    _socket!.on('intelligence_update', (data) {
      if (!_disposed && !_controller.isClosed) {
        _controller.add(data as Map<String, dynamic>);
      }
    });
  }

  void _scheduleReconnect(String userId) {
    if (_disposed) return;
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      // Silently stop — backend is not available. App continues in offline mode.
      return;
    }

    _reconnectAttempts++;
    final delaySeconds = _baseDelaySeconds * _reconnectAttempts;

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: delaySeconds), () {
      if (_disposed) return;
      _socket?.connect();
    });
  }

  void _startHeartbeat(String userId) {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_socket != null && !_socket!.connected && !_disposed) {
        _scheduleReconnect(userId);
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void disconnect() {
    _stopHeartbeat();
    _reconnectTimer?.cancel();
    _socket?.disconnect();
    _socket = null;
    _reconnectAttempts = 0;
  }

  void dispose() {
    _disposed = true;
    disconnect();
    _controller.close();
  }
}
