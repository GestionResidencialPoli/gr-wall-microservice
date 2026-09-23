import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import config from "./config";
import postRouter from "./routers/post-router";
import authenticate from "./middlewares/authenticate";
import handleError from "./middlewares/handle-error";
import openapi from "./docs/openapi";

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
    this.app.use(handleError);
  }

  private useMiddleware(): void {
    this.app.set("trust proxy", 1);
    this.app.use(helmet());
    this.app.use(cors({ origin: config.corsAllowedOrigins, credentials: true }));
    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(morgan(config.env === "production" ? "combined" : "dev"));
    this.app.use(globalRateLimiter);
    this.app.use(authenticate);
  }

  private mountRoutes(): void {
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    if (config.env !== "production") {
      this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
    }

    this.app.use("/api/v1/publicaciones", postRouter());
  }
}

export default new Server();
