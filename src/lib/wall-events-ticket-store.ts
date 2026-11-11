import redis from "./redis-client";
import TokenService from "./token-service";

class WallEventsTicketStore {
  public static async consume(jti: string): Promise<boolean> {
    const result = await redis.set(`wall:ws-ticket:${jti}`, "1", "EX", TokenService.wallEventsTicketTtlSeconds, "NX");
    return result === "OK";
  }
}

export default WallEventsTicketStore;
