import RabbitMqClient from "./rabbitmq-client";
import config from "../config";
import Logger from "./logger";

export type WallEventType = "post.created" | "post.updated" | "post.retired";

export interface WallEvent {
  type: WallEventType;
  postId: number;
  categoria: string;
  fijada: boolean;
}

class WallEventsPublisher {
  public static async publish(event: WallEvent): Promise<void> {
    try {
      const channel = await RabbitMqClient.getChannel();
      channel.publish(config.rabbitmq.eventsExchange, "", Buffer.from(JSON.stringify(event)), { persistent: true });
    } catch (error) {
      Logger.warn("No se pudo publicar el evento del muro", { error: (error as Error).message, event });
    }
  }
}

export default WallEventsPublisher;
