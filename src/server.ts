import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import rateLimit from "express-rate-limit";
import config from "./config";

const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});

class Server {
  public app: Application;

  public httpServer: http.Server;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.setup();
  }

  private setup(): void {
    this.useMiddleware();
    this.mountRoutes();
  }

  private useMiddleware(): void {
    this.app.set("trust proxy", 1);
    this.app.use(helmet());
    this.app.use(cors({ origin: config.corsAllowedOrigins, credentials: true }));
    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(morgan(config.env === "production" ? "combined" : "dev"));
    this.app.use(globalRateLimiter);
  }

  private mountRoutes(): void {
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });
  }
}

export default new Server();
