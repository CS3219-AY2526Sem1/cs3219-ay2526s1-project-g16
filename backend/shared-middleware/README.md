# CS3219 project: PeerPrep

## Shared middleware

### Quick Start

1. In the `shared-middleware` directory, run `npm run build` to output file in `dist`.
2. This creates a module that other microservices can install.
3. In other microservices, run `npm install ../shared-middleware` to install the dependency.
4. This allows other microservices to utilise middleware like authenticateJWT in their routes and access req.user (contains id, username, email, isAdmin) in Requests.

### Linter and Formatter

1. Run `npm run lint` to view code and formatting errors.
2. Run `npm run lint:fix` to automatically fix errors. Some errors cannot be automatically fixed.
