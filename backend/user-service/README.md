# CS3219 project: PeerPrep

## User Service

### Quick Start

1. In the `user-service` directory, create a `.env` file.
2. Create a Postgres DB instance and obtain the connection string.
3. Add the connection string to the `.env` file under the variable `DATABASE_URL`.
4. Ensure you are in the `user-service` directory, then install project dependencies with `npm install`.
5. Start the User Service with `npm start` or `npm run dev`.
6. If the server starts successfully, you will see a "User service server listening on ..." message.

### Prisma

1. Run `npx prisma migrate dev --name [migration name]` when updating the schema of the database to apply changes to the database.
2. Run `npx prisma generate` to regenerate the type-safe client used to interact with your database in your code.
