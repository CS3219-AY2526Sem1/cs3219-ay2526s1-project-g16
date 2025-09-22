import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/user-routes.ts';

dotenv.config();

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

// Tell the application to use the homeRoutes for all requests to the root path
app.use('/user', userRoutes);

app.listen(port, () => {
  console.log(`User service is running at http://localhost:${port}`);
});