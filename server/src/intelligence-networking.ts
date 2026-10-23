import { IntelligenceKnowingANewThread } from "@openbot/toolkit/copilotkit/agents";

/** Runtime 1.77.0 exposes runner/client getters, but one constructor URL. */
export class LocallyAddressedIntelligence extends IntelligenceKnowingANewThread {
  constructor(
    config: ConstructorParameters<typeof IntelligenceKnowingANewThread>[0],
    private readonly browserGateway?: string,
  ) {
    super(config);
    if (
      browserGateway &&
      !["ws:", "wss:"].includes(new URL(browserGateway).protocol)
    ) {
      throw new Error(
        "INTELLIGENCE_CLIENT_GATEWAY_WS_URL must use ws:// or wss://",
      );
    }
  }

  override ɵgetClientWsUrl(): string {
    if (!this.browserGateway) return super.ɵgetClientWsUrl();
    return `${this.browserGateway.replace(/\/(?:runner|client|channels)\/?$/, "").replace(/\/$/, "")}/client`;
  }
}
