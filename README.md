[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/QUdQy4ix)
# CS3219 Project (PeerPrep) - AY2526S1
## Group: G16

## Overview
**PeerPrep** is a collaborative coding platform that pairs users to solve algorithm questions in real time.  
It is built with a **microservices architecture**, ensuring scalability, modularity, and maintainability.

---

## **Architecture**
The system consists of several microservices communicating via REST APIs:
- **User Service** – Manages users, authentication, and profiles  
- **Question Service** – Stores and retrieves coding questions  
- **Match Service** – Handles matchmaking logic using Redis  
- **Collaboration Service** – Manages real-time coding sessions  
- **Attempt Service** – Stores user code attempts and history  
- **API Gateway** – Single entry point handling routing, JWT auth, and rate limiting
- **Code Runner** - Runs user code to return result or error if any.


All services are containerized with Docker and deployed on a shared private network.

<img width="1237" height="622" alt="Architecture" src="https://github.com/user-attachments/assets/a59926bf-515d-4563-a6a8-3514bd990969" />

## **Tech Stack**
- **Frontend:** React, Tanstack, Tailwind, Vite
- **Backend:** Node.js, Express.js  
- **Database:** PostgreSQL (Google Cloud SQL)  
- **Cache/Queue:** Redis  
- **Deployment:** Google Cloud Platform (Dockerized)  
- **Auth:** JWT (access & refresh tokens)  
- **Docs:** [API Documentation](https://cs3219-ay2526sem1.github.io/cs3219-ay2526s1-project-g16/backend/api-documentation/)

## **Key Features**
- Real-time peer matching with Redis queues and atomic transactions  
- Collaborative coding rooms via the Collaboration Service  
- Centralized authentication and routing through API Gateway  
- Persistent question and attempt history with version tracking  

## **Deployment**
Each service runs as an independent container on Google Cloud.  
Only the **API Gateway** is publicly accessible; all other services communicate privately.

## **Development Setup**

### Prerequisites
Before starting, make sure you have the following installed:
- **Docker & Docker Compose** – required to run all services
- **Node.js 18+** – optional, for local service development
- **PostgreSQL 14+** and **Redis** – optional, if running services manually
- **Prisma CLI** – optional, for managing database migrations

### Starting Each Service
#### Frontend
Navigate to `<project-dir>/frontend` and run:
```bash
docker build -t <container-name> .
docker run --rm -p <host-port>:<container-port> <container-name>
```

#### Backend
Navigate to `<project-dir>/backend/<microservice-directory>` and run:
```bash
docker build -t <container-name> .
docker run --rm -p <host-port>:<container-port> <container-name>
```

This will:
- Build the service containers
- Run the service containers

## **Environment Setup**
Each microservice loads its own configuration from a `.env` file.
To set up for local development, create one by copying the example:

```
DATABASE_URL =
PORT =
ACCESS_JWT_SECRET =
REFRESH_JWE_SECRET =
```
## **Services and Ports**

| Service | Port (Internal) | Description |
|----------|-----------------|--------------|
| **API Gateway** | 8080 | Central routing, authentication, and rate limiting |
| **User Service** | 3000 | Manages users and authentication |
| **Matching Service** | 3010 | Redis-based matchmaking between users |
| **Question Service** | 3002 | Handles coding questions and topics |
| **Attempt Service** | 3003 | Stores and retrieves user code attempts |
| **Code Runner Service** | 3005 | Executes user code |
| **Collab Service** | 3009 | Manages real-time collaborative sessions |
| **Redis Cache** | 6379 | In-memory queue and message broker |

## **AI Usage Declaration**
AI has been used for this project in the following areas:
- Documentation generation and overall grammar fixing
- Refactoring code
- Question generation for populating the database

All AI outputs have been reviewed before use.
