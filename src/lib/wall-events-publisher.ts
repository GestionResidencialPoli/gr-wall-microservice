import CommunicationsClient, { type Audience } from "./communications-client";
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

const AUDIENCIA: Audience = { roles: ["ADMINISTRACION", "VIGILANTE", "RESIDENTE"] };

class WallEventsPublisher {
  public static async publish(event: WallEvent): Promise<void> {
    await Promise.all([this.publishToBroker(event), this.notify(event)]);
  }

  private static async notify(event: WallEvent): Promise<void> {
    if (event.type !== "post.created") return;

    try {
      await CommunicationsClient.emit(event.type, AUDIENCIA, { postId: event.postId, categoria: event.categoria });
    } catch (error) {
      Logger.warn("No se pudo notificar la publicacion por el hub", { error: (error as Error).message, event });
    }
  }

  private static async publishToBroker(event: WallEvent): Promise<void> {
    try {
      const channel = await RabbitMqClient.getChannel();
      channel.publish(config.rabbitmq.eventsExchange, "", Buffer.from(JSON.stringify(event)), { persistent: true });
    } catch (error) {
      Logger.warn("No se pudo publicar el evento del muro", { error: (error as Error).message, event });
    }
  }
}

export default WallEventsPublisher;
