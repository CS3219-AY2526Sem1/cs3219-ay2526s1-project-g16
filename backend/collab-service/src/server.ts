import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import collabRoutes from "./routes/collab-routes.ts";
import { initConnection } from "./model/collab-model.ts";
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
app.use("/collab", collabRoutes);



const httpServer = createServer(app);

initConnection().then(() => {
    installCollabWsProxy(httpServer);
    httpServer.listen(process.env.PORT || 3009, () => {
      console.log(`Collab HTTP+WS gateway on port 3009 ; upstream y-websocket on 1234}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
