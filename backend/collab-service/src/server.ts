import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import collabRoutes from "./routes/collab-routes.ts";
import { sweepExpiredSessions, initConnection, ensureDbGuards } from "./model/collab-model.ts";
import { installCollabWsProxy } from "./ws/collab-ws.ts";
import cookieParser from "cookie-parser"; 


dotenv.config();

const app = express();
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: ['http://localhost:3000', 'http://localhost:3009', 'http://127.0.0.1:3000', 'http://127.0.0.1:3009'], 
}));
app.use(express.json());
app.use("/", collabRoutes);



const httpServer = createServer(app);

initConnection().then(async () => {
    await ensureDbGuards();

    installCollabWsProxy(httpServer);
    httpServer.listen(process.env.PORT || 3009, "0.0.0.0", () => {
      console.log(`Collab HTTP+WS gateway on port 3009 ; upstream y-websocket on 1234`);
    });

    setInterval(async () => { // session sweeper that runs every minute
      try {
        const res = await sweepExpiredSessions();
        if (res.expired > 0) console.log(`[sweeper] timed out ${res.expired} sessions`);
      } catch (e) {
        console.error("[sweeper] error:", e);
      }
    }, 6000_000);  // reset to 60000 (every min) after demo
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
