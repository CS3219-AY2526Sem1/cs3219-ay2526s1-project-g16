import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import userRoutes from './routes/user-routes.ts';

dotenv.config();

const app = express();

// Use cors to allow any origin to access this app.
app.use(cors());

app.use(express.json());

const port = process.env.PORT || 3000;

// Add user routes
app.use('/user', userRoutes);

app.listen(port, () => {
  console.log(`User service is running at http://localhost:${port}`);
});