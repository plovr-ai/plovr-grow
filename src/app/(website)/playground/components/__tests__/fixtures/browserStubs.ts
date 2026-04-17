/**
 * Browser-layer stubs for JSDOM.
 *
 * Why: real `WavMediaManager` calls `AudioContext` + `getUserMedia`, neither
 * of which exists in JSDOM. We swap ONLY `WavMediaManager` and leave
 * `WebSocketTransport`, `ProtobufFrameSerializer`, and the rest of the SDK
 * fully real so RTVI protocol + connect/disconnect lifecycle are exercised.
 *
 * Consumer (in the test file) does:
 *   vi.mock("@pipecat-ai/websocket-transport", async () => {
 *     const actual = await vi.importActual<typeof import("@pipecat-ai/websocket-transport")>(
 *       "@pipecat-ai/websocket-transport",
 *     );
 *     return { ...actual, WavMediaManager: FakeWavMediaManager };
 *   });
 */

export class FakeWavMediaManager {
  private _micEnabled = true;
  private _userAudioCallback: ((data: ArrayBuffer) => void) | null = null;

  setUserAudioCallback(cb: (data: ArrayBuffer) => void): void {
    this._userAudioCallback = cb;
  }
  setClientOptions(): void {}
  async initialize(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async userStartedSpeaking(): Promise<unknown> {
    return undefined;
  }
  bufferBotAudio(): Int16Array {
    return new Int16Array();
  }
  async getAllMics(): Promise<MediaDeviceInfo[]> {
    return [];
  }
  async getAllCams(): Promise<MediaDeviceInfo[]> {
    return [];
  }
  async getAllSpeakers(): Promise<MediaDeviceInfo[]> {
    return [];
  }
  updateMic(): void {}
  updateCam(): void {}
  updateSpeaker(): void {}
  get selectedMic(): MediaDeviceInfo | Record<string, never> {
    return {};
  }
  get selectedCam(): MediaDeviceInfo | Record<string, never> {
    return {};
  }
  get selectedSpeaker(): MediaDeviceInfo | Record<string, never> {
    return {};
  }
  enableMic(enable: boolean): void {
    this._micEnabled = enable;
  }
  enableCam(): void {}
  enableScreenShare(): void {}
  get isMicEnabled(): boolean {
    return this._micEnabled;
  }
  get isCamEnabled(): boolean {
    return false;
  }
  get isSharingScreen(): boolean {
    return false;
  }
  get supportsScreenShare(): boolean {
    return false;
  }
  tracks(): Record<string, never> {
    return {};
  }
}
